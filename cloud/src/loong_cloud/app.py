import argparse
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from time import monotonic

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status
from starlette.exceptions import HTTPException

from loong_cloud.cache import CacheProxy
from loong_cloud.config.config_global import GlobalConfig
from loong_cloud.core.logging import log_exception, configure_logging
from loong_cloud.api import router
from loong_cloud.common.response import Response
from loong_cloud.core.container import  ApplicationContainer
from loong_cloud.db.db_proxy import AsyncDatabaseProxy
from loong_cloud.install_setting import SERVICE_TARGETS, WIRE_TARGETS
from loong_cloud.middleware.loading_middleware import loading_middleware
from loong_cloud.schema import load_tables
from loong_contracts.utis.datetime_util import utcnow


def _get_path() -> str:
    parser = argparse.ArgumentParser(description="Loong Cloud 服务启动工具")

    parser.add_argument(
        "-p", "--path",
        type=Path,
        required=True,  # 如果设为 True，不传 --path 会直接报错；如果想有默认值，可以去掉 required 并改用 default
        help="指定全局配置文件的路径",
    )

    args = parser.parse_args()

    if not args.path.exists():
        print(f"错误: 配置文件路径不存在 -> {args.path.resolve()}")
        SystemExit(1)

    return args.path


def create_app() -> FastAPI:
    config_path = _get_path()

    global_config = GlobalConfig.load(config_path)
    configure_logging(global_config.log_level)
    load_tables(global_config.db_config.table_prefix)

    db_proxy = AsyncDatabaseProxy(global_config.db_config)
    cache_proxy = CacheProxy(global_config.cache_config)

    def mark_started(app: FastAPI) -> None:
        app.state.started_at = datetime.now(timezone.utc)
        app.state.started_monotonic = monotonic()

    @asynccontextmanager
    async def lifespan(app):
        try:
            mark_started(app)
            await db_proxy.start_proxy()
            await cache_proxy.start_proxy()
            yield
        except Exception as exc:
            log_exception(exc, "云端服务生命周期异常")
            raise
        finally:
            try:
                await cache_proxy.close()
            except Exception as exc:
                log_exception(exc, "关闭缓存失败")

            try:
                if db_proxy.status:
                    await db_proxy.close_db()
            except Exception as exc:
                log_exception(exc, "关闭数据库失败")

    app = FastAPI(title="Loong Cloud", version="0.1.0", lifespan=lifespan,
                  docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json",
                  swagger_ui_oauth2_redirect_url="/api/docs/oauth2-redirect")
    app.state.started_at = utcnow()
    app.state.started_monotonic = monotonic()

    container = ApplicationContainer(
        global_config=global_config,
        cache_proxy=cache_proxy,
        db_proxy=db_proxy,
        service_targets=SERVICE_TARGETS,
        wire_targets=WIRE_TARGETS)

    app.state.container = container
    app.include_router(router)

    loading_middleware(app)

    def error_response(request, code, message, headers=None):
        body = Response.fail(request, code=code, msg=message)
        # 未处理异常的响应由最外层异常处理器生成，也需要携带上下文响应头。
        response_headers = dict(headers or {})
        response_headers["X-Request-ID"] = body.request_id
        response_headers["X-Request-Date"] = body.request_date.isoformat()
        return JSONResponse(status_code=code, content=body.model_dump(mode="json"), headers=response_headers)

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        log_exception(exc, f"HTTP 请求异常, path:{request.url.path}", request_id=request.state.request_id,
                      request_date=request.state.request_date.isoformat(), status_code=exc.status_code)
        return error_response(request, exc.status_code, str(exc.detail), exc.headers)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        log_exception(exc, f"请求参数校验失败, path:{request.url.path}", request_id=request.state.request_id,
                      request_date=request.state.request_date.isoformat(), status_code=status.HTTP_422_UNPROCESSABLE_CONTENT)
        return error_response(request, status.HTTP_422_UNPROCESSABLE_CONTENT, "请求参数校验失败")

    @app.exception_handler(Exception)
    async def unexpected_error(request, exc):

        log_exception(exc, f"服务内部异常, path:{request.url.path}", request_id=request.state.request_id,
                      request_date=request.state.request_date.isoformat(), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return error_response(request, status.HTTP_500_INTERNAL_SERVER_ERROR, "服务内部错误")

    return app
