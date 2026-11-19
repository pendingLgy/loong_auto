from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from loong_local.config.config_global import GlobalConfig
from loong_local.core.container import ApplicationContainer
from loong_local.middleware import SessionMiddleware, LocalAccessMiddleware
from loong_local.middleware.request import RequestMiddleware


def loading_middleware(app: FastAPI):
    app_container: ApplicationContainer = app.state.container
    global_config: GlobalConfig = app.state.global_config

    app.add_middleware(SessionMiddleware,
                       session_config_service=app_container.SessionConfigService())

    app.add_middleware(LocalAccessMiddleware, allowed_hosts=global_config.gateway_config.allowed_hosts)

    app.add_middleware(CORSMiddleware,
                       allow_origins=global_config.gateway_config.allowed_origins,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
                       allow_headers=["Authorization", "Content-Type", "Accept", "Last-Event-ID",
                                      "X-Tenant-ID", "X-User-ID", "X-Platform", "X-Session-ID",
                                      "X-Security-Token"],
                       expose_headers=["X-Request-ID", "X-Request-Date", "X-Local-Request-ID"])

    app.add_middleware(RequestMiddleware)
