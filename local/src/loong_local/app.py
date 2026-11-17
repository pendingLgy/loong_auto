"""组装依赖；后台工具任务与客户端界面生命周期分离。"""
import argparse
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from time import monotonic

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from starlette import status
from starlette.responses import JSONResponse

from loong_cloud_client import CloudClient
from loong_contracts.utis import Response
from loong_contracts.utis.uuid_util import uuid_str
from loong_local.core.logging import configure_logging, log_exception
from .api import router
from .config.config_global import GlobalConfig
from .core.container import ApplicationContainer
from .db.sqlite_db import AsyncSqliteDB
from .install_setting import SERVICE_TARGETS, WIRE_TARGETS
from .middleware.loading_middleware import loading_middleware
from .schema import load_tables


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

    sqlite_db = AsyncSqliteDB(sqlite_config=global_config.db_config)

    def mark_started(app: FastAPI) -> None:
        app.state.started_at = datetime.now(timezone.utc)
        app.state.started_monotonic = monotonic()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            mark_started(app)
            await sqlite_db.start()
            yield
        except Exception as exc:
            log_exception(exc, "云端服务生命周期异常")
            raise
        finally:
            try:
                if sqlite_db.status:
                    await sqlite_db.close()
            except Exception as exc:
                log_exception(exc, "关闭数据库失败")

    container = ApplicationContainer(
        db=sqlite_db,
        gateway_config=global_config.gateway_config,
        service_targets=SERVICE_TARGETS,
        wire_targets=WIRE_TARGETS)

    app = FastAPI(title="Loong Local Gateway", version="0.2.0", lifespan=lifespan)

    app.state.client_id = uuid_str()
    app.state.container = container
    app.state.global_config = global_config

    cloud_client = CloudClient(httpx.AsyncClient(
        base_url=global_config.gateway_config.cloud_url,
        timeout=global_config.gateway_config.timeout,
        follow_redirects=False, trust_env=False,
    ))

    app.state.cloud_client = cloud_client

    loading_middleware(app)

    app.include_router(router)

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
                      request_date=request.state.request_date.isoformat(),
                      status_code=status.HTTP_422_UNPROCESSABLE_CONTENT)
        return error_response(request, status.HTTP_422_UNPROCESSABLE_CONTENT, "请求参数校验失败")

    @app.exception_handler(Exception)
    async def unexpected_error(request, exc):

        log_exception(exc, f"服务内部异常, path:{request.url.path}", request_id=request.state.request_id,
                      request_date=request.state.request_date.isoformat(),
                      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return error_response(request, status.HTTP_500_INTERNAL_SERVER_ERROR, "服务内部错误")

    return app
