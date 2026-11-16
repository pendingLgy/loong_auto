"""本地网关中间件装配。"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loong_local.gateway.config import GatewayConfig
from .access import LocalAccessMiddleware


def loading_middleware(app: FastAPI, config: GatewayConfig) -> None:
    app.add_middleware(CORSMiddleware, allow_origins=config.allowed_origins,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
                       allow_headers=["Authorization", "Content-Type", "Accept", "X-Tenant-ID"],
                       expose_headers=["X-Request-ID", "X-Request-Date", "X-Local-Request-ID"])
    app.add_middleware(LocalAccessMiddleware, allowed_origins=config.allowed_origins)
