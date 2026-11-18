from pydantic import BaseModel, Field

from loong_contracts.common.tool_constant import ToolTaskStatus


class ToolApprovalInfo(BaseModel):
    summary: str | None = Field(default=None, description="汇总信息")
    risk_reason: str | None = Field(default=None, description="高危操作元ing")


class TollApprovalResponse(BaseModel):
    status: ToolTaskStatus = Field(default=ToolTaskStatus.PENDING,description="工具执行状态")
    message: str | None = Field(default=None, description="高危操作原因")
    approval_info: ToolApprovalInfo = Field(default_factory=ToolApprovalInfo)
