from typing import Any

from pydantic import BaseModel

from loong_contracts.response.base import BigIntId


class UserInfoResponse(BaseModel):
    id: BigIntId
    tenant_id: BigIntId
    username: str
    name: str | None = None
    role: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_info: dict[str, Any]
