from typing import Generic, TypeVar
from datetime import datetime
from ..common import Contract


T = TypeVar("T")


class BaseResponse(Contract, Generic[T]):
    code: int = 0
    msg: str = "success"
    data: T | None = None
    request_date: datetime
    request_id: str
