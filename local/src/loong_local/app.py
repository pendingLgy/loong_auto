"""Web、TUI、Desktop 共用的本地云端转发服务。"""
from contextlib import asynccontextmanager

import httpx
from loong_cloud_client import CloudClient
from fastapi import FastAPI
from loguru import logger

from .logger.logging import configure_logging

from .gateway.config import GatewayConfig
from .api import router
from .middleware import loading_middleware


def create_app(config: GatewayConfig | None = None) -> FastAPI:
    config = config or GatewayConfig.load()

    @asynccontextmanager
    async def lifespan(app):
        sinks = configure_logging(config.log_path)
        try:
            async with httpx.AsyncClient(base_url=str(config.cloud_url),
                timeout=httpx.Timeout(config.timeout, connect=config.connect_timeout, read=config.sse_read_timeout),
                follow_redirects=False, trust_env=False,
            ) as client:
                app.state.cloud_client = CloudClient(client)
                yield
        finally:
            for sink in sinks:
                logger.remove(sink)

    app = FastAPI(title="Loong Local Gateway", version="0.1.0", lifespan=lifespan)
    app.state.gateway_config = config
    loading_middleware(app, config)
    app.include_router(router)
    return app
