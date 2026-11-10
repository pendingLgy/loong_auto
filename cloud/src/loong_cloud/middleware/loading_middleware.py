from fastapi import FastAPI

from loong_cloud.config import GlobalConfig, authentication_public_paths
from loong_cloud.middleware import AuthenticationMiddleware, RequestContextMiddleware


def loading_middleware(app: FastAPI, global_config: GlobalConfig):
    app.add_middleware(AuthenticationMiddleware,
                       public_paths=authentication_public_paths(global_config.white_list_urls))
    # 后注册的中间件先执行，确保认证失败也具有请求上下文。
    app.add_middleware(RequestContextMiddleware)
