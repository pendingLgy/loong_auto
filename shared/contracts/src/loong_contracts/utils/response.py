from typing import Any, TypeVar

from fastapi import Request

from loong_contracts.response import BaseResponse
from loong_contracts.response.base import BasePageResponse

T = TypeVar("T")


class Response:
    """公共响应工厂；请求上下文由 RequestContextMiddleware 提供。"""

    @staticmethod
    def ok(request: Request, data: T | None = None, *, msg: str = "success") -> BaseResponse[T]:
        return BaseResponse(data=data, code=200, msg=msg,
                            request_id=request.state.request_id,
                            request_date=request.state.request_date)

    @staticmethod
    def fail(request: Request, *, code: int = 500, msg: str = "fail",
             data: T | None = None) -> BaseResponse[T]:
        if code == 0:
            raise ValueError("失败响应的 code 不能为 0")
        return BaseResponse(data=data, code=code, msg=msg,
                            request_id=request.state.request_id,
                            request_date=request.state.request_date)


class PageResponse:
    """公共响应工厂；请求上下文由 RequestContextMiddleware 提供。"""

    def ok(request: Request, page: BasePageResponse | None = None, *, msg: str = "success") -> BasePageResponse[
                                                                                                   Any] | None:
        page.request_id = request.state.request_id
        page.request_date = request.state.request_date
        page.code = 200
        page.msg = msg
        return page

