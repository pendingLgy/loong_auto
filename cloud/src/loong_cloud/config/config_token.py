from pydantic import BaseModel, ConfigDict, Field


class TokenConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    secret: str | None = Field(default=None, min_length=32, repr=False, description="JWT HS256 签名密钥，登录启用时必须配置")
    issuer: str = Field(default="loong-cloud", min_length=1, description="JWT 签发方")
    access_ttl: int = Field(default=3600, gt=0, description="访问令牌有效期（秒）")
    refresh_ttl: int = Field(default=604800, gt=0, description="刷新令牌有效期（秒）")
