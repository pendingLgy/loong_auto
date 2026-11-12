from datetime import datetime
from typing import Generic, TypeVar, Annotated

from pydantic import PlainSerializer, BeforeValidator, BaseModel, ConfigDict


def _parse_to_int(v) -> int:
    """入参清洗：无论是 str 还是 int，都安全转为 int"""
    if isinstance(v, str):
        v = v.strip()
        if not v.isdigit():
            raise ValueError("ID 必须是合法的数字")
    return int(v)


# 定义一个全能型的 BigIntId
BigIntId = Annotated[
    int,
    BeforeValidator(_parse_to_int),  # 1. 接收时：自动把 str/int 统一转为 int
    PlainSerializer(lambda x: str(x), return_type=str)  # 2. 输出时：自动把 int 转为 str
]

T = TypeVar("T")


class BaseResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(extra="forbid")

    code: int = 0
    msg: str = "success"
    data: T | None = None
    request_date: datetime
    request_id: str
