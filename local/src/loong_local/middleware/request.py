from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from loong_contracts.utis.datetime_util import utcnow
from loong_contracts.utis.uuid_util import uuid_str


class RequestMiddleware:
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

        await self.app(scope, receive, send)
