import argparse
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from time import monotonic

from exception_handler import register_exception_handlers
from fastapi import FastAPI
from loong_contracts.utils.datetime_util import utcnow

from loong_cloud.api import router
from loong_cloud.cache import CacheProxy
from loong_cloud.config.config_global import GlobalConfig
from loong_cloud.core.container import ApplicationContainer
from loong_cloud.core.logging import configure_logging, log_exception
from loong_cloud.db.db_proxy import AsyncDatabaseProxy
from loong_cloud.install_setting import SERVICE_TARGETS, WIRE_TARGETS
from loong_cloud.middleware.loading_middleware import loading_middleware
from loong_cloud.schema import load_tables


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

    register_exception_handlers(app)
    return app
