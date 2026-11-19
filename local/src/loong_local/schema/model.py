# 任务状态字面量类型约束
from datetime import datetime
from typing import Literal, Optional, Dict, Any

from pydantic import BaseModel, ConfigDict, Field

from loong_contracts.common.tool_constant import ToolTaskStatus

WorkspaceModeLiteral = Literal["read_only", "workspace_write", "full"]


class PendingToolTaskModel(BaseModel):
    """
    接收 pending_tool_tasks 表记录的数据模型
    """
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = Field(default=None, description="数据库自增主键 ID")
    tool_id: Optional[str] = Field(default=None, description="工具调用唯一ID (LLM tool_call_id)")
    session_id: str = Field(description="会话ID，用于关联聊天上下文")
    tool_name: str = Field(description="工具名称，如 execute_command")

    # 数据库存储为 JSON Text，模型中自动解析为字典供业务直接使用
    request_data: Dict[str, Any] = Field(default_factory=dict, description="工具请求参数字典")

    summary: str = Field(description="操作摘要（如具体的 Shell 命令）")
    risk_reason: Optional[str] = Field(default=None, description="高风险原因说明")
    status: ToolTaskStatus = Field(default=ToolTaskStatus.PENDING, description="任务状态")

    created_at: Optional[datetime] = Field(default=None, description="挂起创建时间")
    updated_at: Optional[datetime] = Field(default=None, description="状态更新时间")


class SessionConfigModel(BaseModel):
    """接收 session_configs 表记录的数据模型。"""

    model_config = ConfigDict(from_attributes=True)

    session_id: str = Field(description="业务会话ID")
    workspace_mode: WorkspaceModeLiteral = Field(default="read_only", description="放行模式")
    workspaces: list[str] = Field(default_factory=list, description="允许的工作目录列表")
    created_at: Optional[datetime] = Field(default=None, description="创建时间")
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")
