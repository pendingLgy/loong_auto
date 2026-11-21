# 任务状态字面量类型约束
from datetime import datetime
from typing import Any

from loong_contracts.common.tool_constant import ToolTaskStatus
from pydantic import BaseModel, ConfigDict, Field

from loong_local.commons.constant import WorkspaceModelType


class PendingToolTaskModel(BaseModel):
    """
    接收 pending_tool_tasks 表记录的数据模型
    """
    model_config = ConfigDict(from_attributes=True)

    id: int | None = Field(default=None, description="数据库自增主键 ID")
    tool_id: str | None = Field(default=None, description="工具调用唯一ID (LLM tool_call_id)")
    session_id: str = Field(description="会话ID，用于关联聊天上下文")
    tool_name: str = Field(description="工具名称，如 execute_command")

    # 数据库存储为 JSON Text，模型中自动解析为字典供业务直接使用
    request_data: dict[str, Any] = Field(default_factory=dict, description="工具请求参数字典")

    summary: str = Field(description="操作摘要（如具体的 Shell 命令）")
    risk_reason: str | None = Field(default=None, description="高风险原因说明")
    status: ToolTaskStatus = Field(default=ToolTaskStatus.PENDING, description="任务状态")

    created_at: datetime | None = Field(default=None, description="挂起创建时间")
    updated_at: datetime | None = Field(default=None, description="状态更新时间")


class SessionConfigModel(BaseModel):
    """接收 session_configs 表记录的数据模型。"""

    model_config = ConfigDict(from_attributes=True)

    session_id: str = Field(description="业务会话ID")
    workspace_mode: WorkspaceModelType = Field(default=WorkspaceModelType.READ_ONLY, description="放行模式")
    workspaces: list[str] = Field(default_factory=list, description="允许的工作目录列表")
    created_at: datetime | None = Field(default=None, description="创建时间")
    updated_at: datetime | None = Field(default=None, description="更新时间")


class SupplierConfigModel(BaseModel):
    """supplier_config 表记录（包含内部使用的原始 API Key）。"""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = Field(default=None, description="数据库自增主键")
    provider: str = Field(description="模型供应商")
    base_url: str | None = Field(default=None, description="供应商 API Base URL")
    api_key: str = Field(description="供应商 API Key")
    created_at: datetime | None = Field(default=None, description="创建时间")
    updated_at: datetime | None = Field(default=None, description="更新时间")


class SupplierConfigResponse(BaseModel):
    """返回给客户端的供应商配置，仅标识是否已配置 API Key。"""

    id: int = Field(description="配置 ID")
    provider: str = Field(description="模型供应商")
    base_url: str | None = Field(default=None, description="供应商 API Base URL")
    popular: bool = Field(default=False, description="热门供应商")
    config_flag: bool = Field(default=False, description="是否配置api_key")
    created_at: datetime | None = Field(default=None, description="创建时间")
    updated_at: datetime | None = Field(default=None, description="更新时间")


class SupplierModelOptionModel(BaseModel):
    """supplier_model_option 表记录。"""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = Field(default=None, description="数据库自增主键")
    provider: str = Field(description="模型供应商")
    model: str = Field(description="模型名称")
    enabled: bool = Field(default=True, description="模型是否启用")
    created_at: datetime | None = Field(default=None, description="创建时间")
    updated_at: datetime | None = Field(default=None, description="更新时间")


class SupplierModelOptionResponse(BaseModel):
    """返回给客户端的模型启用配置。"""

    id: int = Field(description="配置 ID")
    provider: str = Field(description="模型供应商")
    model: str = Field(description="模型名称")
    enabled: bool = Field(default=True, description="模型是否启用")
    created_at: datetime | None = Field(default=None, description="创建时间")
    updated_at: datetime | None = Field(default=None, description="更新时间")
