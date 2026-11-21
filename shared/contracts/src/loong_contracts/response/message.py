
from pydantic import BaseModel

from loong_contracts.response.base import BigIntId


class RawMessageResponse(BaseModel):
    id: BigIntId
    tenant_id: BigIntId
    user_id: BigIntId
    session_id: str
    model: str | None = None
    message_id: str | None = None
    created: BigIntId | None = None
    role: str | None = None
    content: str | None = None
    tool_calls: str | None = None
    tool_call_id: str | None = None


