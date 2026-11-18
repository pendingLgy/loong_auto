"""工具契约：工具只声明能力与参数，安全检查与沙箱由 ToolExecutor 统一处理。

工具实现里不应出现路径校验、权限判断或子进程启动；这些都由执行器完成，
工具只接收执行器准备好的 ``ToolContext``（已校验路径 + 受控沙箱）。
"""
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import ClassVar, Generic, Mapping, TypeVar

from pydantic import BaseModel, Field

from loong_contracts.agent.models import ToolDefinition

from .security import PathPermission, SandboxExecutor, SandboxResult, WorkspacePolicy


class BaseToolParameters(BaseModel):
    dangerous: bool = Field(
        default=False,
        description="大模型初步评估该命令是否具备破坏性或高风险（如删除文件、修改系统配置等）"
    )

    risk_reason: str = Field(
        default="",
        description="若评估为高风险，请在此简述原因，该说明将展示给用户进行人工审批"
    )


class ToolExecutionError(Exception):
    def __init__(self, message: str, code: int = 500):
        super().__init__(message)
        self.code = code


class ToolUnauthorizedError(ToolExecutionError):
    def __init__(self, detail: str):
        super().__init__(f"操作被拦截：该操作被判定为高危，且未获得用户授权 -> [{detail}]", code=403)


class ToolSuspendedError(Exception):
    """高危操作需要人工审核时抛出，由网关持久化并等待审批。"""

    def __init__(self, tool_id: str, tool_name: str, request_data: dict,
                 summary: str, risk_reason: str):
        self.tool_id = tool_id
        self.tool_name = tool_name
        self.request_data = request_data
        self.summary = summary
        self.risk_reason = risk_reason
        super().__init__(f"工具 [{tool_name}] (ID: {tool_id}) 需要人工审核: {summary}")


@dataclass(frozen=True)
class PathArgument:
    """工具声明的路径参数；执行器据此完成归属与权限校验。"""

    value: str
    permission: PathPermission
    allow_missing: bool = False


@dataclass(frozen=True)
class ToolContext:
    """执行器为工具准备的受控执行环境。

    工具只能通过 ``path()`` 取已校验的绝对路径、通过 ``run()`` 在沙箱内执行进程，
    不允许自行拼接或解析工作区路径。
    """

    workspaces: tuple[Path, ...]
    policy: WorkspacePolicy
    paths: Mapping[str, Path]
    sandbox: SandboxExecutor | None = None

    def path(self, name: str) -> Path:
        try:
            return self.paths[name]
        except KeyError:
            raise ToolExecutionError(f"执行器未提供路径参数：{name}") from None

    async def run(self, argv, *, timeout: float | None = None) -> SandboxResult:
        if self.sandbox is None:
            raise ToolExecutionError("该工具未启用沙箱执行")
        return await self.sandbox.run(argv, timeout=timeout)

    def display_path(self, target: Path) -> str:
        for root in self.workspaces:
            if target == root or target.is_relative_to(root):
                return str(target.relative_to(root))
        return str(target)


InputT = TypeVar("InputT", bound=BaseToolParameters)
OutputT = TypeVar("OutputT", bound=BaseModel)


class ABSTool(ABC, Generic[InputT, OutputT]):
    """工具能力声明与执行实现；安全策略全部由执行器负责。"""

    tool_name: ClassVar[str]
    description: ClassVar[str]
    request_model: type[InputT]

    # 该工具是否属于高危操作（workspace_write 模式下需要人工确认）。
    requires_approval: ClassVar[bool] = False
    # 是否需要沙箱执行进程。
    uses_sandbox: ClassVar[bool] = False
    # 生成审批摘要时展示的字段。
    summary_fields: ClassVar[tuple[str, ...]] = ()
    # 需要对命令中的路径做额外校验的参数名（Shell 类工具使用）。
    command_field: ClassVar[str | None] = None

    @classmethod
    def definition(cls) -> ToolDefinition:
        return ToolDefinition(
            name=cls.tool_name,
            description=cls.description,
            location="remote",
            parameters=cls.request_model.model_json_schema()
        )

    @classmethod
    def system_prompt(cls) -> str:
        """工具专属的系统提示词；默认空字符串。"""
        return ""

    def path_arguments(self, request: InputT) -> dict[str, PathArgument]:
        """声明本次调用涉及的路径参数；由执行器统一校验。"""
        return {}

    @abstractmethod
    async def execute(self, context: ToolContext, request: InputT) -> OutputT:
        """执行工具；不得绕过 context 访问文件系统或启动进程。"""
        ...


def default_shell() -> str:
    """当前平台的默认 Shell 可执行文件。"""
    import shutil

    shell = ((shutil.which("pwsh") or shutil.which("powershell")) if os.name == "nt"
             else (shutil.which("bash") or shutil.which("sh")))
    if not shell:
        raise RuntimeError("未找到可用的 Shell")
    return shell
