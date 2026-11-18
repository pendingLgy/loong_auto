"""为每个 HTTP 请求创建唯一 SSEContext，不区分 SSE 与普通 API。"""
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from loong_cloud_client import CloudClient
from loong_contracts.utis import Response
from loong_contracts.utis.datetime_util import utcnow
from loong_contracts.utis.uuid_util import uuid_str
from ..core.context import SSEContext


class SessionMiddleware:
    def __init__(self, app: ASGIApp):
        self.app: ASGIApp = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request = Request(scope)

        # 请求上下文供公共响应工厂与异常处理器使用。
        request.state.request_id = uuid_str()
        request.state.request_date = utcnow()

        x_client_id = request.headers.get("x-client-id", "")
        if x_client_id == "":
            body = Response.fail(request, code=status.HTTP_400_BAD_REQUEST, msg="请求头 x-client-id 为空")
            response = JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=body.model_dump(mode="json"))
            await response(scope, receive, send)
            return


        token = request.headers.get("authorization", "")

        # 令牌按请求透传，不写入共享 HTTP 客户端的默认请求头，避免并发请求互相覆盖。
        cloud_client: CloudClient = request.app.state.cloud_client

        request.state.sse_context = SSEContext(client_id=x_client_id,
                                               local_request_id=uuid_str(),
                                               authorization=token,
                                               tenant_id=request.headers.get("x-tenant-id"),
                                               user_id=request.headers.get("x-user-id"),
                                               platform=request.headers.get("x-platform"),
                                               cloud_client=cloud_client
                                               )

        await self.app(scope, receive, send)
