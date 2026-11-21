"""工具执行统一入口：所有安全检查与沙箱执行都在这里完成。

职责边界：
- 工具只声明能力（``requires_approval``、``uses_sandbox``、``path_arguments``）并实现 ``execute``；
- 执行器负责工具白名单、权限矩阵、路径校验、审批判定、沙箱执行与审计；
- 工具拿到的 ``ToolContext`` 只包含已校验的路径和受控沙箱，无法绕过检查。

执行器是应用级单例：不同会话的放行策略与工作目录在**执行时**通过
``inspect`` / ``execute`` 的参数传入，执行器按 (策略, 工作目录) 缓存对应的
``PathGuard`` 与沙箱，不会为每个请求重建执行器。
"""
import json
import os
import re
import shlex
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from loguru import logger

from loong_local.tools.base_tool import ABSTool, BaseToolParameters, PathArgument, ToolContext, ToolSuspendedError, ToolUnauthorizedError
from loong_local.tools.registry import GLOBAL_TOOL_REGISTRY, ToolRegistry
from loong_local.tools.security import (
    AuditLogger,
    PathGuard,
    PathPermission,
    PathSecurityAction,
    PathSecurityError,
    SandboxConfig,
    SandboxExecutor,
    ToolGuard,
    ToolPermissionError,
    ToolPermissionGuard,
    WorkspacePolicy,
)

# 这些参数名后面的取值一定是路径（Shell 命令解析用）。
_PATH_OPTIONS = frozenset({"-path", "-literalpath", "-destination", "-source", "-file"})
_DRIVE_PATH = re.compile(r"^[A-Za-z]:[\\/]")
_PATH_SEPARATOR = re.compile(r"[\\/]")


@dataclass(frozen=True)
class ToolCallRequest:
    """一次工具调用的入参：工具名、调用 id 与原始参数。"""

    tool_id: str
    tool_name: str
    arguments: Any = None


@dataclass(frozen=True)
class ToolInspection:
    """准入后的调用信息；SSE 调度用它决定直接执行还是落库待审批。"""

    tool: ABSTool
    request: BaseToolParameters
    context: ToolContext
    needs_approval: bool
    summary: str
    risk_reason: str


class ToolExecutor:
    """工具调用的唯一入口；执行时按会话传入策略与工作目录。"""

    def __init__(
            self,
            *,
            registry: ToolRegistry,
            tool_guard: ToolGuard,
            permission_guard: ToolPermissionGuard,
            path_guard: PathGuard,
            sandbox_config: SandboxConfig,
    ) -> None:

        # 默认策略 / 默认工作目录：调用方没有传会话配置时使用。
        self.registry = registry or GLOBAL_TOOL_REGISTRY
        self.tool_guard = tool_guard or ToolGuard()
        self.permission_guard = permission_guard or ToolPermissionGuard()
        self.path_guard = path_guard
        self.sandbox_config = sandbox_config

        # 按 (策略, 工作目录) 缓存，避免每次执行重建守卫与沙箱。
        self._runtime_cache: dict[tuple, tuple[PathGuard, SandboxExecutor]] = {}

    # -------------------------------------------------------------- 运行时解析
    def _runtime(self, policy: WorkspacePolicy, workspaces: Iterable[Path],
                 ) -> tuple[WorkspacePolicy, tuple[Path, ...], PathGuard, SandboxExecutor]:
        """解析本次执行的策略与工作目录，并按需缓存守卫与沙箱。

        执行器与守卫都不持有默认值：会话配置必须以参数形式传入。
        """
        try:
            resolved = tuple(Path(workspace).resolve(strict=True) for workspace in workspaces)
        except OSError as exc:
            raise ToolUnauthorizedError(f"会话工作目录不可用：{exc}") from exc
        if not resolved:
            raise ToolUnauthorizedError("会话未配置工作目录")

        key = (policy.mode.value, tuple(str(path) for path in resolved))
        entry = self._runtime_cache.get(key)
        if entry is None:
            reference = self.path_guard
            guard = PathGuard(
                allow_absolute_path=reference.allow_absolute_path,
                allow_path_traversal=reference.allow_path_traversal,
                allow_symlink=reference.allow_symlink,
                follow_symlink=reference.follow_symlink,
            )
            entry = (guard, SandboxExecutor(resolved[0], self.sandbox_config))
            self._runtime_cache[key] = entry
        return policy, resolved, entry[0], entry[1]

    # ------------------------------------------------------------------ 准入
    def inspect(self, tool_name: str, arguments: Any = None, *,
                policy: WorkspacePolicy,
                workspaces: Iterable[Path]) -> ToolInspection:
        """按本次执行的会话配置校验工具与路径，给出审批建议；不执行副作用。"""
        self.tool_guard.check_tool(tool_name)

        if not self.permission_guard.permissions(tool_name):
            raise ToolPermissionError(f"工具 {tool_name} 未在权限矩阵中声明能力")

        tool = self.registry.create_tool_instance(tool_name)
        effective_policy, resolved, guard, sandbox = self._runtime(policy, workspaces)

        try:
            request = tool.request_model(**self._arguments(arguments))
        except ValueError as exc:
            raise ToolUnauthorizedError(f"工具参数不合法：{exc}") from exc

        paths = self._resolve_paths(tool, request, effective_policy, guard, resolved)
        if tool.uses_sandbox:
            self._require_execute_permission(tool, guard, resolved, effective_policy)
        if tool.command_field:
            self._validate_command_paths(tool, request, guard, resolved, effective_policy)

        needs_approval = tool.requires_approval and effective_policy.requires_approval
        summary = self._summary(tool, request)
        risk_reason = getattr(request, "risk_reason", "") if needs_approval else ""

        context = ToolContext(
            workspaces=resolved,
            policy=effective_policy,
            paths=paths,
            sandbox=sandbox if tool.uses_sandbox else None,
        )
        return ToolInspection(tool=tool, request=request, context=context,
                              needs_approval=needs_approval, summary=summary,
                              risk_reason=risk_reason)

    # ------------------------------------------------------------------ 执行
    async def execute(self, call: ToolCallRequest, *, approved: bool = False,
                      policy: WorkspacePolicy,
                      workspaces: Iterable[Path]):
        """执行一次工具调用；高危操作未授权时抛 ToolSuspendedError。"""
        inspection = self.inspect(call.tool_name, call.arguments,
                                  policy=policy, workspaces=workspaces)

        if inspection.needs_approval and not approved:
            AuditLogger.tool_call(tool_name=call.tool_name, tool_id=call.tool_id,
                                  result="suspended", security_action="APPROVAL_REQUIRED")
            raise ToolSuspendedError(
                tool_id=call.tool_id,
                tool_name=call.tool_name,
                request_data=inspection.request.model_dump(mode="json"),
                summary=inspection.summary,
                risk_reason=inspection.risk_reason,
            )

        try:
            result = await inspection.tool.execute(inspection.context, inspection.request)
        except Exception as exc:
            logger.warning("工具执行失败 tool={} tool_id={} error={}", call.tool_name, call.tool_id, exc)
            AuditLogger.tool_call(tool_name=call.tool_name, tool_id=call.tool_id,
                                  result="error", security_action="EXECUTE")
            raise

        AuditLogger.tool_call(tool_name=call.tool_name, tool_id=call.tool_id,
                              result="success", security_action="EXECUTE")
        return result

    # -------------------------------------------------------------- 路径校验
    @staticmethod
    def _resolve_paths(tool: ABSTool, request: BaseToolParameters, policy: WorkspacePolicy,
                       guard: PathGuard, workspaces: tuple[Path, ...]) -> dict[str, Path]:
        base = workspaces[0]
        resolved: dict[str, Path] = {}
        for name, argument in tool.path_arguments(request).items():
            if not isinstance(argument, PathArgument):
                raise ToolUnauthorizedError(f"工具 {tool.tool_name} 的路径参数声明不合法：{name}")
            try:
                if argument.allow_missing:
                    target = guard.validate_reference(
                        argument.value, workspaces=workspaces, policy=policy,
                        base=base, tool_name=tool.tool_name)
                    ToolExecutor._ensure_writable_ancestor(policy, target, argument.permission)
                else:
                    target = guard.resolve_path(
                        argument.value, workspaces=workspaces, policy=policy,
                        permission=argument.permission, base=base,
                        tool_name=tool.tool_name)
            except PathSecurityError as exc:
                raise ToolUnauthorizedError(f"{tool.tool_name}.{name}: {exc}") from exc
            resolved[name] = target
        return resolved

    @staticmethod
    def _ensure_writable_ancestor(policy: WorkspacePolicy, target: Path,
                                  permission: PathPermission) -> None:
        """allow_missing 路径：校验最近一个已存在祖先目录是否可写。"""
        if not policy.allows(permission):
            raise PathSecurityError(
                f"当前放行模式（{policy.mode.value}）不允许 {permission.value}：{target}",
                action=PathSecurityAction.PERMISSION_DENIED)

        existing = target.parent
        while not existing.exists() and existing != existing.parent:
            existing = existing.parent
        if not existing.exists():
            raise PathSecurityError(f"找不到可用的父目录：{target}",
                                    action=PathSecurityAction.NOT_FOUND)
        if not os.access(existing, os.W_OK):
            raise PathSecurityError(f"没有写入权限：{existing}",
                                    action=PathSecurityAction.PERMISSION_DENIED)

    @staticmethod
    def _require_execute_permission(tool: ABSTool, guard: PathGuard,
                                    workspaces: tuple[Path, ...],
                                    policy: WorkspacePolicy) -> None:
        try:
            guard.check_permission(workspaces[0], PathPermission.EXECUTE,
                                   workspaces=workspaces, policy=policy)
        except PathSecurityError as exc:
            raise ToolUnauthorizedError(f"{tool.tool_name}: {exc}") from exc

    @staticmethod
    def _validate_command_paths(tool: ABSTool, request: BaseToolParameters,
                                guard: PathGuard, workspaces: tuple[Path, ...],
                                policy: WorkspacePolicy) -> None:
        command = getattr(request, tool.command_field or "", "")
        if not isinstance(command, str) or not command.strip():
            return

        base = workspaces[0]
        for raw in _extract_paths(command):
            try:
                guard.validate_reference(raw, workspaces=workspaces, policy=policy,
                                         base=base, tool_name=tool.tool_name)
            except PathSecurityError as exc:
                raise ToolUnauthorizedError(f"{tool.tool_name}: {exc}") from exc

    # ------------------------------------------------------------------ 杂项
    @staticmethod
    def _summary(tool: ABSTool, request: BaseToolParameters) -> str:
        parts = []
        for field in tool.summary_fields:
            value = getattr(request, field, None)
            if value not in (None, ""):
                parts.append(f"{field}={value}")
        return f"{tool.tool_name}：" + "，".join(parts) if parts else f"调用工具 {tool.tool_name}"

    @staticmethod
    def _arguments(value: Any) -> dict[str, Any]:
        if value is None:
            return {}
        if isinstance(value, str):
            try:
                parsed = json.loads(value or "{}")
            except json.JSONDecodeError as exc:
                raise ValueError(f"工具参数不是合法 JSON：{value}") from exc
            if not isinstance(parsed, dict):
                raise ValueError("工具参数必须是 JSON 对象")
            return parsed
        if isinstance(value, dict):
            return dict(value)
        raise ValueError("工具参数必须是字典或 JSON 字符串")


def _looks_like_path(token: str) -> bool:
    if not token or token.startswith("-"):
        return False
    return bool(_DRIVE_PATH.match(token)
                or token.startswith(("\\", "/", ".", "~"))
                or _PATH_SEPARATOR.search(token))


def _extract_paths(command: str) -> list[str]:
    """从 Shell 命令中提取可能是路径的参数；只用于保守校验。"""
    try:
        tokens = [token.strip("\"'") for token in shlex.split(command, posix=False)]
    except ValueError:
        raise ToolUnauthorizedError(f"命令引号不成对，无法校验路径：{command}") from None

    paths: list[str] = []
    expect_path = False
    for token in tokens:
        if expect_path:
            paths.append(token)
            expect_path = False
            continue
        if token.lower() in _PATH_OPTIONS:
            expect_path = True
            continue
        if _looks_like_path(token):
            paths.append(token)
    return paths
