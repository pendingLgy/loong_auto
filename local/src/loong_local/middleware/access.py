"""限制本地 Host 和浏览器来源。"""
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from loong_contracts.utis import Response


class LocalAccessMiddleware:
    def __init__(self, app: ASGIApp, allowed_origins: list[str]):
        self.app, self.allowed_origins = app, frozenset(allowed_origins)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            request = Request(scope)
            if request.url.hostname not in {"127.0.0.1", "localhost", "::1"}:
                body = Response.fail(request, code=status.HTTP_400_BAD_REQUEST, msg="不允许的 Host")
                response = JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=body.model_dump(mode="json"))
                await response(scope, receive, send)
                return

            origin = request.headers.get("origin")
            if origin and origin not in self.allowed_origins:
                body = Response.fail(request, code=status.HTTP_403_FORBIDDEN, msg="不允许的 Origin")
                response = JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content=body.model_dump(mode="json"))
                await response(scope, receive, send)
                return

        await self.app(scope, receive, send)
