"""全局异常处理：统一响应包装与带请求上下文的日志。

从 app.py 抽离，保证应用装配只负责依赖组装；新增异常类型时在此注册。
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from httpx import HTTPStatusError
from loong_contracts.utils import Response
from loong_contracts.utils.datetime_util import utcnow
from loong_contracts.utils.uuid_util import uuid_str
from starlette import status
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from loong_local.commons.rebuild_header import rebuild_cloud_response_header
from loong_local.core.exceptions import CloudHttpError, ToolExecuteError
from loong_local.core.logging import log_exception


def _ensure_request_context(request: Request) -> None:
    """异常可能发生在 SessionMiddleware 之前，这里补齐响应工厂需要的字段。"""
    if not hasattr(request.state, "request_id"):
        request.state.request_id = uuid_str()
    if not hasattr(request.state, "request_date"):
        request.state.request_date = utcnow()


def _error_response(request: Request, code: int, message: str, headers=None) -> JSONResponse:
    _ensure_request_context(request)
    body = Response.fail(request, code=code, msg=message)
    # 未处理异常的响应由最外层异常处理器生成，也需要携带上下文响应头。

    rebuild_cloud_response_header(headers)
    response_headers = dict(headers or {})
    response_headers["X-Request-ID"] = body.request_id
    response_headers["X-Request-Date"] = body.request_date.isoformat()
    return JSONResponse(status_code=code, content=body.model_dump(mode="json"),
                        headers=response_headers)


def _log_context(request: Request) -> dict:
    _ensure_request_context(request)
    return {"request_id": request.state.request_id,
            "request_date": request.state.request_date.isoformat()}


def register_exception_handlers(app: FastAPI) -> None:
    """注册全局异常处理器。"""

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        log_exception(exc, f"HTTP 请求异常, path:{request.url.path}",
                      status_code=exc.status_code, **_log_context(request))
        return _error_response(request, exc.status_code, str(exc.detail), exc.headers)

    @app.exception_handler(HTTPStatusError)
    async def http_status_error(request: Request, exc: HTTPStatusError):
        log_exception(exc, f"HTTP 状态异常, path:{request.url.path}",
                      status_code=exc.response.status_code, **_log_context(request))


        return _error_response(request, exc.response.status_code, str(exc.response.text), exc.response.headers)

    @app.exception_handler(CloudHttpError)
    async def cloud_http_error(request: Request, exc: CloudHttpError):
        log_exception(exc, f"Cloud HTTP 状态异常, path:{request.url.path}",
                      status_code=exc.status, **_log_context(request))


        return _error_response(request, exc.status, str(exc.message), exc.response.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        log_exception(exc, f"请求参数校验失败, path:{request.url.path}",
                      status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, **_log_context(request))
        return _error_response(request, status.HTTP_422_UNPROCESSABLE_CONTENT, "请求参数校验失败")

    @app.exception_handler(ToolExecuteError)
    async def tool_error(request: Request, exc: ToolExecuteError):
        log_exception(exc, f"工具执行异常, path:{request.url.path}",
                      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, **_log_context(request))
        return _error_response(request, status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        log_exception(exc, f"服务内部异常, path:{request.url.path}",
                      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, **_log_context(request))
        return _error_response(request, status.HTTP_500_INTERNAL_SERVER_ERROR, "服务内部错误")
