"""本地工具审批请求。"""
from pydantic import BaseModel, ConfigDict, Field


class ToolApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    approved: bool = Field(description="用户是否确认执行本次命令")
