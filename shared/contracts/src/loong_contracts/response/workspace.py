from datetime import datetime

from pydantic import BaseModel

from loong_contracts.response.base import BigIntId


class WorkspaceResponse(BaseModel):
    id: BigIntId
    tenant_id: BigIntId
    user_id: BigIntId
    name: str | None = None
    path: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
