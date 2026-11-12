from fastapi import FastAPI

from loong_cloud.config import authentication_public_paths
from loong_cloud.core.container import ApplicationContainer
from loong_cloud.middleware import AuthenticationMiddleware, RequestContextMiddleware
from loong_cloud.middleware.tenant_resolve import TenantResolveMiddleware


def loading_middleware(app: FastAPI):
    app_container: ApplicationContainer = app.state.container
    app.add_middleware(
        AuthenticationMiddleware,
        public_paths=authentication_public_paths(app_container.global_config.white_list_urls),
        token_service=app_container.TokenService(),
        user_store=app_container.UserStore(),
    )
    app.add_middleware(TenantResolveMiddleware)

    # 后注册的中间件先执行，确保认证失败也具有请求上下文。
    app.add_middleware(RequestContextMiddleware)
