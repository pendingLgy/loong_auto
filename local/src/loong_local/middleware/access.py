"""校验本机 Host 和浏览器 Origin，直接透传 SSE 响应。"""
from starlette.datastructures import Headers, URL
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


class LocalAccessMiddleware:
    def __init__(self, app: ASGIApp, allowed_origins: list[str]):
        self.app = app
        self.allowed_origins = frozenset(allowed_origins)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        origin = Headers(scope=scope).get("origin")
        if origin and origin not in self.allowed_origins:
            await JSONResponse({"msg": "不允许的客户端来源"}, status_code=403)(scope, receive, send)
            return
        if URL(scope=scope).hostname not in {"127.0.0.1", "localhost", "::1"}:
            await JSONResponse({"msg": "不允许的本地主机名"}, status_code=400)(scope, receive, send)
            return
        await self.app(scope, receive, send)
