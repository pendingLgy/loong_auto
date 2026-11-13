"""适配器内部的连接数据，由供应商 YAML 解析。"""

from pydantic import BaseModel, Field, field_validator


class ProviderConnection(BaseModel):
    base_url: str = Field(description="API 根地址")
    timeout: float = Field(default=60, gt=0, description="超时秒数")

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        from urllib.parse import urlsplit

        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("模型地址必须为不包含账号密码的 HTTP/HTTPS URL")
        if parsed.query or parsed.fragment:
            raise ValueError("模型地址不能包含查询参数或片段")
        return value.rstrip("/")
