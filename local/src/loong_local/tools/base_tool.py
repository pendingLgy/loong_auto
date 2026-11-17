"""工具只处理执行，不依赖 HTTP 或界面。"""
from abc import ABC, abstractmethod
from pathlib import Path
from typing import ClassVar, Generic, TypeVar, Optional
from pydantic import BaseModel
from loong_contracts.agent.models import ToolDefinition


class BaseToolRequest(BaseModel):
    tool_id: str


class ToolExecutionError(Exception):
    def __init__(self, message: str, code: int = 500):
        super().__init__(message)
        self.code = code

class ToolUnauthorizedError(ToolExecutionError):
    def __init__(self, command_or_detail: str):
        super().__init__(f"操作被拦截：该操作被判定为高危，且未获得用户授权 -> [{command_or_detail}]", code=403)


class ToolSuspendedError(Exception):
    """
    【挂起中断异常】
    当高危操作需要人工审核时抛出。
    网关捕获该异常后，可将 details 序列化返回给前端，等待用户审批。
    """
    def __init__(self, tool_id: str, tool_name: str, request_data: dict, summary: str, risk_reason: str):
        self.tool_id = tool_id
        self.tool_name = tool_name
        self.request_data = request_data
        self.summary = summary
        self.risk_reason = risk_reason
        super().__init__(f"工具 [{tool_name}] (ID: {tool_id}) 需要人工审核: {summary}")


InputT = TypeVar("InputT", bound=BaseToolRequest)
OutputT = TypeVar("OutputT", bound=BaseModel)

class ABSTool(ABC, Generic[InputT, OutputT]):
    tool_name: ClassVar[str]
    description: ClassVar[str]
    request_model: type[InputT]

    def __init__(self, workspace: Path):
        self.workspace = workspace.resolve(strict=True)
        if not self.workspace.is_dir():
            raise ValueError("工作区必须是目录")

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
        """
        工具专属的系统提示词/操作规范。
        默认返回空字符串，子类可按需重写以注入安全守则、使用限制等。
        """
        return ""

    def is_dangerous(self, request: InputT) -> bool:
        return True

    def approval_details(self, request: InputT) -> tuple[str, str]:
        return request.model_dump_json(), "工具操作需要授权"

    async def __call__(self, request: InputT, *, approved: bool = False) -> OutputT:
        if self.is_dangerous(request) and not approved:
            # 获取工具提供的审批详情
            summary, reason = self.approval_details(request)
            # 抛出挂起异常，带上当前请求的 dict 数据以便后续恢复
            raise ToolSuspendedError(
                tool_id=request.tool_id,
                tool_name=self.tool_name,
                request_data=request.model_dump(mode="json"),
                summary=summary,
                risk_reason=reason
            )

        return await self.execute(request, approved=approved)

    @abstractmethod
    async def execute(self, request: InputT, *, approved: bool = False) -> OutputT:
        ...