"""为每次 HTTP 请求生成服务端请求标识与 UTC 接收时间。"""

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from loong_contracts.common import identifier, utcnow
from loguru import logger


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        state = scope.setdefault("state", {})
        state["request_id"] = identifier()
        state["request_date"] = utcnow()

        async def send_with_context(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = state["request_id"]
                headers["X-Request-Date"] = state["request_date"].isoformat()
            await send(message)

        # 直接透传响应体，避免缓冲 SSE 流。
        with logger.contextualize(request_id=state["request_id"],
                                  request_date=state["request_date"].isoformat()):
            await self.app(scope, receive, send_with_context)
