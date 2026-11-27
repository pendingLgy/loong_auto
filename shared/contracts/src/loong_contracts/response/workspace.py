import json
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from loong_contracts.response.base import BigIntId


class WorkspaceResponse(BaseModel):
    id: BigIntId
    tenant_id: BigIntId
    user_id: BigIntId
    name: str | None = None
    path: list[str] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator("path", mode="before")
    @classmethod
    def parse_path(cls, value):
        """数据库存储 JSON 字符串，兼容旧的单路径字符串。"""
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return [str(item) for item in value]
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return [value]
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
            return [str(parsed)]
        return [str(value)]
