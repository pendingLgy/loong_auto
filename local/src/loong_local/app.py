"""组装依赖；后台工具任务与客户端界面生命周期分离。"""
import argparse
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from secrets import token_urlsafe
from time import monotonic

import httpx
from fastapi import FastAPI
from loguru import logger
from loong_cloud_client import CloudClient
from loong_contracts.utils.uuid_util import identifier

from loong_local.api import router
from loong_local.config.config_global import GlobalConfig
from loong_local.core.container import ApplicationContainer
from loong_local.core.logging import configure_logging, log_exception
from loong_local.db.sqlite_db import AsyncSqliteDB
from loong_local.exception_handlers import register_exception_handlers
from loong_local.install_setting import SERVICE_TARGETS, WIRE_TARGETS, init_tools
from loong_local.middleware.loading_middleware import loading_middleware
from loong_local.schema import load_tables
from loong_local.tools.registry import GLOBAL_TOOL_REGISTRY
from loong_local.tools.security import PathGuard, SandboxConfig, ToolGuard, ToolPermissionGuard
from loong_local.tools.tool_executor import ToolExecutor


def resolve_server_token(configured: str) -> tuple[str, str]:
    """配置了令牌就沿用，否则生成随机令牌；返回 (token, source)。"""
    token = (configured or "").strip()
    if token:
        return token, "config"
    return token_urlsafe(32), "generated"


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
    security_token, server_token_source = resolve_server_token(global_config.security_token)

    configure_logging(global_config.log_level)
    load_tables(global_config.db_config.table_prefix)

    sqlite_db = AsyncSqliteDB(sqlite_config=global_config.db_config)

    def mark_started(app: FastAPI) -> None:
        app.state.started_at = datetime.now(UTC)
        app.state.started_monotonic = monotonic()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            mark_started(app)
            await sqlite_db.start()

            logger.info(
                f"本地网关已启动 | security_token={security_token} | source={server_token_source}")

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

    app = FastAPI(title="Loong Local Gateway", version="0.2.0", lifespan=lifespan)

    app.state.client_id = identifier()  # init client_id for start
    app.state.global_config = global_config
    app.state.security_token = security_token
    app.state.enable_security_token = global_config.enable_security_token

    app.state.container = ApplicationContainer(
        db=sqlite_db,
        gateway_config=global_config.gateway_config,
        service_targets=SERVICE_TARGETS,
        wire_targets=WIRE_TARGETS)

    # 工具执行器随应用启动创建；先把当前提供的工具全部注册进注册表，
    # 白名单直接取注册表里的工具名，保证"注册了什么就只允许什么"。
    init_tools()

    app.state.tool_executor = ToolExecutor(
        registry=GLOBAL_TOOL_REGISTRY,
        tool_guard=ToolGuard(allowed_tools=GLOBAL_TOOL_REGISTRY.list_tool_names()),
        permission_guard=ToolPermissionGuard(),
        path_guard=PathGuard(),
        sandbox_config=SandboxConfig(),
    )

    app.state.cloud_client = CloudClient(httpx.AsyncClient(
        base_url=global_config.gateway_config.cloud_url,
        timeout=global_config.gateway_config.timeout,
        follow_redirects=False, trust_env=False,
    ))

    loading_middleware(app)

    app.include_router(router)

    register_exception_handlers(app)

    return app
