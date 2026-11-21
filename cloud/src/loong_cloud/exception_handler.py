from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from loong_contracts.utils import Response
from starlette import status
from starlette.exceptions import HTTPException

from loong_cloud.core.exceptions import BaseError
from loong_cloud.core.logging import log_exception


def error_response(request, code: int, message: str, headers=None) -> JSONResponse:
    body = Response.fail(request, code=code, msg=message)

    # 未处理异常的响应由最外层异常处理器生成，也需要携带上下文响应头。
    response_headers = dict(headers or {})
    response_headers["X-Request-ID"] = body.request_id
    response_headers["X-Request-Date"] = body.request_date.isoformat()
    return JSONResponse(status_code=code, content=body.model_dump(mode="json"),
                        headers=response_headers)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_error(request, exc: HTTPException):
        log_exception(
            exc,
            f"HTTP 请求异常, path:{request.url.path}",
            status_code=exc.status_code,
        )
        return error_response(request, exc.status_code, str(exc.detail), exc.headers)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc: RequestValidationError):
        log_exception(
            exc,
            f"请求参数校验失败, path:{request.url.path}",
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        )
        return error_response(request, status.HTTP_422_UNPROCESSABLE_CONTENT, "请求参数校验失败")

    @app.exception_handler(Exception)
    async def unexpected_error(request, exc: Exception):

        if isinstance(exc, BaseError):
            logger.warning(
                f"业务异常:{str(exc)}",
            )
            return error_response(request, status.HTTP_400_BAD_REQUEST, str(exc))

        log_exception(
            exc,
            f"服务内部异常, path:{request.url.path}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        return error_response(request, status.HTTP_500_INTERNAL_SERVER_ERROR, "服务内部错误")
