from datetime import datetime

from pydantic import BaseModel

from loong_contracts.response.base import BigIntId


class SessionSimpleResponse(BaseModel):
    id: BigIntId
    tenant_id: BigIntId
    user_id: BigIntId
    session_id: str
    session_title: str | None = None
    workspace_id: BigIntId | None = None
    model: str | None = None
    message_id: str | None = None
    created_at: datetime | None = None
