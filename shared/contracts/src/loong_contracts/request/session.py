from pydantic import BaseModel, Field

from loong_contracts.response.base import BigIntId


class CreateSessionRequest(BaseModel):
    """新增会话。"""

    session_id: str = Field(min_length=1, max_length=64, description="业务会话 ID")
    session_title: str = Field(min_length=1, max_length=256, description="会话标题")
    workspace_id: BigIntId = Field(description="所属工作目录 ID")


class UpdateSessionRequest(BaseModel):
    """编辑会话。"""

    session_title: str | None = Field(default=None, min_length=1, max_length=256, description="会话标题")
    workspace_id: BigIntId = Field(description="所属工作目录 ID")
