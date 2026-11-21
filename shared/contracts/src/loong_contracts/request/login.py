from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LoginPlatform = Literal["web", "cli", "tui", "electron"]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    username: str = Field(min_length=1, max_length=128, pattern=r"^\S+$")
    password: str = Field(min_length=8, max_length=256, repr=False)
    platform: LoginPlatform = Field(default="web", description="登录平台，用于隔离平台会话")


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)

    username: str = Field(min_length=1, max_length=128, pattern=r"^\S+$")
    password: str = Field(min_length=8, max_length=256, repr=False)
    name: str | None = Field(default=None, max_length=256)


class RefreshTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: str = Field(min_length=1, max_length=8192, repr=False)
