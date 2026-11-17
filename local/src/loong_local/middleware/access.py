"""限制本地 Host 和浏览器来源。"""
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.types import ASGIApp, Receive, Scope, Send


class LocalAccessMiddleware:
    def __init__(self, app: ASGIApp, allowed_origins: list[str]):
        self.app, self.allowed_origins = app, frozenset(allowed_origins)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            request = Request(scope)
            if request.url.hostname not in {"127.0.0.1", "localhost", "::1"}:
                await PlainTextResponse("不允许的 Host", 400)(scope, receive, send)
                return
            origin = request.headers.get("origin")
            if origin and origin not in self.allowed_origins:
                await PlainTextResponse("不允许的 Origin", 403)(scope, receive, send)
                return
        await self.app(scope, receive, send)
