from time import monotonic

from loguru import logger
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from loong_contracts.utis.datetime_util import utcnow
from loong_contracts.utis.uuid_util import uuid_str


class RequestContextMiddleware:
    """为每次 HTTP 请求生成服务端请求标识与 UTC 接收时间。"""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:

        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        state = scope.setdefault("state", {})
        state["request_id"] = uuid_str()
        state["request_date"] = utcnow()
        started_at = monotonic()

        async def send_with_context(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = state["request_id"]
                headers["X-Request-Date"] = state["request_date"].isoformat()
            await send(message)

        # 直接透传响应体，避免缓冲 SSE 流。
        with logger.contextualize(request_id=state["request_id"],
                                  request_date=state["request_date"].isoformat()):
            try:
                await self.app(scope, receive, send_with_context)
            finally:
                logger.info(
                    "请求结束 method={} path={} elapsed_ms={:.3f}",
                    scope["method"], scope["path"],
                    (monotonic() - started_at) * 1000,
                )
