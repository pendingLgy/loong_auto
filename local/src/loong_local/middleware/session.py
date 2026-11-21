"""为每个 HTTP 请求创建唯一 SSEContext。

只有 ``/message`` 与 ``/sse`` 是会话相关的业务路径，必须在 ``x-session-id``
对应的会话配置存在时才放行；其它接口（会话配置管理、通用转发等）不做拦截，
有会话头时仍会使用该会话的策略与工作目录。
"""
from loong_cloud_client import CloudClient
from loong_contracts.utils.uuid_util import uuid_str
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from loong_local.core.context import SSEContext
from loong_local.service.session_config_service import SessionConfigService

# 需要会话配置才能访问的业务路径。
SESSION_PATH_PREFIXES = ("/message", "/sse")


class SessionMiddleware:
    def __init__(self, app: ASGIApp, session_config_service: SessionConfigService):
        self.app: ASGIApp = app
        self.session_config_service: SessionConfigService = session_config_service

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)

        token = request.headers.get("authorization", "")

        cloud_client: CloudClient = request.app.state.cloud_client

        request.state.sse_context = SSEContext(
            client_id=request.app.state.client_id,
            local_request_id=uuid_str(),
            authorization=token,
            tenant_id=request.headers.get("x-tenant-id"),
            user_id=request.headers.get("x-user-id"),
            platform=request.headers.get("x-platform"),
            tool_executor=request.app.state.tool_executor,
            cloud_client=cloud_client
        )

        await self.app(scope, receive, send)
