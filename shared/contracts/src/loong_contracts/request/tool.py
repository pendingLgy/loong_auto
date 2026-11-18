"""本地工具审批请求。"""

from typing import Any, Dict, Optional

from pydantic import Field, BaseModel


class ToolInvokeRequest(BaseModel):
    """
    前端或调度层发起工具调用时的标准请求结构。
    """
    session_id: str = Field(
        description="当前对话或会话的唯一标识，用于挂起状态的持久化与关联"
    )

    tool_id: str = Field(
        description="工具调用id"
    )

    tool_name: str = Field(
        description="要调用的目标工具名称，例如 execute_command"
    )
    arguments: Dict[str, Any] = Field(
        default_factory=dict,
        description="传给工具的具体参数字典（对应各个工具的 request_model 字段，如 command, dangerous 等）"
    )
    approved: bool = Field(
        default=False,
        description="安全授权标记。高风险操作初次调用时为 false，人工审批通过后发起恢复时传 true"
    )
    request_id: Optional[str] = Field(
        default=None,
        description="可选的幂等或请求追踪 ID，用于日志链路追踪"
    )

