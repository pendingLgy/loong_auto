"""路径安全：规范化、工作区边界、符号链接与权限校验。

LLM 返回的路径一律视为不可信输入；所有工具的文件访问都必须经过本模块，
任何工具都不能直接用原始路径访问文件系统。

本模块只是基础路径校验，不能替代操作系统级沙箱：写入/删除仍存在符号链接
竞争与 TOCTOU 风险，生产环境应使用 openat/openat2 + RESOLVE_BENEATH /
RESOLVE_NO_SYMLINKS，或容器、独立低权限用户、只读挂载等隔离手段。
"""
import json
import os
from dataclasses import dataclass
from enum import Enum
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Sequence, Union

from .audit import AuditLogger

PathLike = Union[str, Path]


class PathPermission(str, Enum):
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    EXECUTE = "execute"


class PathSecurityAction(str, Enum):
    ALLOW = "ALLOW"
    INVALID_PATH = "INVALID_PATH"
    ABSOLUTE_PATH = "ABSOLUTE_PATH"
    UNC_PATH = "UNC_PATH"
    PATH_TRAVERSAL = "PATH_TRAVERSAL"
    OUTSIDE_WORKSPACE = "OUTSIDE_WORKSPACE"
    SYMLINK = "SYMLINK"
    NOT_FOUND = "NOT_FOUND"
    PERMISSION_DENIED = "PERMISSION_DENIED"


class PathSecurityError(Exception):
    """路径非法或越权。"""

    def __init__(self, message: str, *, action: PathSecurityAction, raw_path: str = "") -> None:
        super().__init__(message)
        self.action = action
        self.raw_path = raw_path


class WorkspaceMode(str, Enum):
    """连接级放行模式。"""

    READ_ONLY = "read_only"            # 仅查看
    WORKSPACE_WRITE = "workspace_write"  # 工作区内修改，高危操作需要人工确认
    FULL = "full"                      # 完全权限，不再逐次人工确认


@dataclass(frozen=True)
class WorkspacePolicy:
    """连接级放行策略，由客户端在建立连接时声明。

    三种模式：
    - ``read_only``：只允许读，写/删/执行一律拒绝；
    - ``workspace_write``：工作区内允许读/写/删/执行，但高危操作需要人工确认；
    - ``full``：工作区内完全权限，不再逐次要求人工确认。

    无论哪种模式，路径仍然必须位于工作区内：工作区边界不随权限放宽。
    """

    mode: WorkspaceMode = WorkspaceMode.READ_ONLY

    @property
    def requires_approval(self) -> bool:
        """高危操作是否需要人工确认。"""
        return self.mode is WorkspaceMode.WORKSPACE_WRITE

    def allows(self, permission: PathPermission) -> bool:
        if self.mode is WorkspaceMode.READ_ONLY:
            return permission is PathPermission.READ
        return True

    @classmethod
    def from_client(cls, raw: str | dict) -> "WorkspacePolicy":
        """解析客户端传入的放行模式。

        支持 ``"read_only"`` 这样的纯字符串、``{"mode": "workspace_write"}`` 对象，
        或 JSON 形式的对象字符串。缺省为 ``read_only``。
        """
        if isinstance(raw, str):
            text = raw.strip()
            data: object = json.loads(text) if text.startswith("{") else {"mode": text}
        else:
            data = raw

        if not isinstance(data, dict):
            raise ValueError("放行策略必须是模式字符串或 JSON 对象")

        unknown = set(data) - {"mode"}
        if unknown:
            raise ValueError(f"放行策略包含未知字段：{sorted(unknown)}")

        mode = data.get("mode") or WorkspaceMode.READ_ONLY.value
        try:
            return cls(mode=WorkspaceMode(mode))
        except ValueError:
            raise ValueError(f"未知的放行模式：{mode}") from None


class PathGuard:
    """把不可信路径限制在授权工作区内。

    守卫本身不持有工作区与策略：调用方在每次校验时传入 ``workspaces`` 与
    ``policy``，同一个实例可以服务不同会话。
    """

    def __init__(
            self,
            *,
            allow_absolute_path: bool = False,
            allow_path_traversal: bool = False,
            allow_symlink: bool = False,
            follow_symlink: bool = False,
    ) -> None:
        self.allow_absolute_path = allow_absolute_path
        self.allow_path_traversal = allow_path_traversal
        self.allow_symlink = allow_symlink
        self.follow_symlink = follow_symlink

    # ------------------------------------------------------------------ 规范化
    def normalize_path(self, raw: PathLike, *, base: PathLike | None = None,
                       workspaces: Sequence[PathLike] = ()) -> Path:
        """解析路径并消解 ``..`` 与符号链接；不检查归属与权限。"""
        if not isinstance(raw, (str, Path)) or not str(raw).strip():
            raise PathSecurityError("路径不能为空", action=PathSecurityAction.INVALID_PATH)

        text = str(raw)
        if "\x00" in text:
            raise PathSecurityError("路径包含非法字符", action=PathSecurityAction.INVALID_PATH,
                                    raw_path=text)
        if text.startswith("~"):
            raise PathSecurityError("不允许使用家目录缩写", action=PathSecurityAction.INVALID_PATH,
                                    raw_path=text)
        if text.startswith(("\\\\", "//")):
            raise PathSecurityError("不允许使用 UNC 路径", action=PathSecurityAction.UNC_PATH,
                                    raw_path=text)

        windows_path = PureWindowsPath(text)
        is_absolute = (windows_path.is_absolute() or bool(windows_path.drive)
                       or Path(text).is_absolute())
        # Windows 下 Path("/etc/passwd") 不算绝对路径，但它仍是外部绝对路径，必须拦截。
        foreign_absolute = os.name == "nt" and text.startswith("/")
        if foreign_absolute or (is_absolute and not self.allow_absolute_path):
            raise PathSecurityError("不允许使用绝对路径", action=PathSecurityAction.ABSOLUTE_PATH,
                                    raw_path=text)

        if not self.allow_path_traversal and ".." in Path(text).parts:
            raise PathSecurityError("不允许路径回退（..）", action=PathSecurityAction.PATH_TRAVERSAL,
                                    raw_path=text)

        candidate = Path(text)
        if not candidate.is_absolute():
            candidate = self._base(base, workspaces) / candidate

        try:
            return candidate.resolve(strict=False)
        except (OSError, RuntimeError) as exc:
            raise PathSecurityError(f"路径无法解析：{text}", action=PathSecurityAction.INVALID_PATH,
                                    raw_path=text) from exc

    @staticmethod
    def _base(base: PathLike | None, workspaces: Sequence[PathLike]) -> Path:
        if base is not None:
            anchor = Path(base)
        elif workspaces:
            anchor = Path(workspaces[0])
        else:
            raise PathSecurityError("缺少基准目录", action=PathSecurityAction.INVALID_PATH)
        try:
            return anchor.resolve(strict=True)
        except OSError as exc:
            raise PathSecurityError(f"基准目录不存在：{anchor}",
                                    action=PathSecurityAction.NOT_FOUND) from exc

    # -------------------------------------------------------------- 工作区边界
    @staticmethod
    def check_workspace(path: Path, workspaces: Sequence[PathLike]) -> Path:
        for workspace in workspaces:
            root = Path(workspace)
            if path == root or path.is_relative_to(root):
                return root
        raise PathSecurityError(f"路径越权访问：{path}", action=PathSecurityAction.OUTSIDE_WORKSPACE)

    @staticmethod
    def relative_path(path: Path, workspaces: Sequence[PathLike]) -> Path:
        return path.relative_to(PathGuard.check_workspace(path, workspaces))

    # ---------------------------------------------------------------- 符号链接
    def check_symlink(self, raw_path: str, path: Path,
                      workspaces: Sequence[PathLike]) -> None:
        if self.allow_symlink and self.follow_symlink:
            # 允许跟随，但 resolve 已经保证目标仍在工作区内。
            return

        root = self.check_workspace(path, workspaces)
        current = root
        for part in path.relative_to(root).parts:
            current = current / part
            if current.is_symlink():
                raise PathSecurityError(f"不允许通过符号链接访问：{current}",
                                        action=PathSecurityAction.SYMLINK, raw_path=raw_path)

    # -------------------------------------------------------------------- 权限
    @staticmethod
    def check_permission(path: Path, permission: PathPermission, *,
                         workspaces: Sequence[PathLike], policy: WorkspacePolicy) -> None:
        root = PathGuard.check_workspace(path, workspaces)
        if not policy.allows(permission):
            raise PathSecurityError(
                f"当前放行模式（{policy.mode.value}）不允许 {permission.value}：{path}",
                action=PathSecurityAction.PERMISSION_DENIED)

        if permission is PathPermission.READ:
            if not path.exists():
                raise PathSecurityError(f"路径不存在：{path}", action=PathSecurityAction.NOT_FOUND)
            if not os.access(path, os.R_OK):
                raise PathSecurityError(f"没有读取权限：{path}",
                                        action=PathSecurityAction.PERMISSION_DENIED)
            return

        if permission is PathPermission.WRITE:
            parent = path.parent
            if parent != root:
                PathGuard.check_workspace(parent, workspaces)
            if not parent.exists():
                raise PathSecurityError(f"父目录不存在：{parent}", action=PathSecurityAction.NOT_FOUND)
            if not os.access(parent, os.W_OK):
                raise PathSecurityError(f"没有写入权限：{parent}",
                                        action=PathSecurityAction.PERMISSION_DENIED)
            if path.exists() and not os.access(path, os.W_OK):
                raise PathSecurityError(f"没有写入权限：{path}",
                                        action=PathSecurityAction.PERMISSION_DENIED)
            return

        if permission is PathPermission.DELETE:
            if not path.exists():
                raise PathSecurityError(f"路径不存在：{path}", action=PathSecurityAction.NOT_FOUND)
            if not os.access(path.parent, os.W_OK):
                raise PathSecurityError(f"没有删除权限：{path.parent}",
                                        action=PathSecurityAction.PERMISSION_DENIED)
            return

        if permission is PathPermission.EXECUTE:
            if not path.exists():
                raise PathSecurityError(f"路径不存在：{path}", action=PathSecurityAction.NOT_FOUND)
            if not path.is_dir() and not os.access(path, os.X_OK):
                raise PathSecurityError(f"没有执行权限：{path}",
                                        action=PathSecurityAction.PERMISSION_DENIED)
            return

        raise PathSecurityError(f"未知的权限类型：{permission}", action=PathSecurityAction.PERMISSION_DENIED)

    @staticmethod
    def check_operation(permission: PathPermission) -> PathPermission:
        """保留操作类型检查入口：当前只校验枚举合法性，便于后续扩展。"""
        if not isinstance(permission, PathPermission):
            raise PathSecurityError(f"未知的操作类型：{permission}",
                                    action=PathSecurityAction.PERMISSION_DENIED)
        return permission

    # ------------------------------------------------------------------ 对外入口
    def validate_reference(self, raw: PathLike, *, workspaces: Sequence[PathLike],
                           policy: WorkspacePolicy, base: PathLike | None = None,
                           tool_name: str = "",
                           permission: PathPermission = PathPermission.READ) -> Path:
        """校验归属与符号链接，但不要求路径已存在（命令参数可能指向待创建文件）。"""
        return self._validate(raw, workspaces=workspaces, policy=policy, base=base,
                              permission=None, tool_name=tool_name,
                              declared_permission=permission)

    def resolve_path(self, raw: PathLike, *, workspaces: Sequence[PathLike],
                     policy: WorkspacePolicy, permission: PathPermission = PathPermission.READ,
                     base: PathLike | None = None, tool_name: str = "") -> Path:
        """完整校验并返回可安全使用的绝对路径。"""
        return self._validate(raw, workspaces=workspaces, policy=policy, base=base,
                              permission=permission, tool_name=tool_name,
                              declared_permission=permission)

    # 兼容旧调用名
    validate_path = resolve_path

    def _validate(self, raw: PathLike, *, workspaces: Sequence[PathLike],
                  policy: WorkspacePolicy, base: PathLike | None,
                  permission: PathPermission | None, tool_name: str,
                  declared_permission: PathPermission) -> Path:
        roots = tuple(Path(workspace) for workspace in workspaces)
        raw_text = str(raw) if isinstance(raw, (str, Path)) else ""
        if not roots:
            raise PathSecurityError("未配置工作区", action=PathSecurityAction.INVALID_PATH)

        try:
            target = self.normalize_path(raw, base=base, workspaces=roots)
            self.check_workspace(target, roots)
            self.check_symlink(raw_text, target, roots)
            if permission is not None:
                self.check_permission(target, permission, workspaces=roots, policy=policy)
        except PathSecurityError as exc:
            AuditLogger.record(tool_name=tool_name, operation=declared_permission.value,
                               original_path=raw_text, resolved_path=None,
                               workspace=str(roots[0]), permission=declared_permission.value,
                               result="blocked", security_action=exc.action.value)
            raise
        AuditLogger.record(tool_name=tool_name, operation=declared_permission.value,
                           original_path=raw_text, resolved_path=str(target),
                           workspace=str(roots[0]), permission=declared_permission.value,
                           result="allowed", security_action=PathSecurityAction.ALLOW.value)
        return target
