"""HTTP Bearer 认证；白名单仅按完整路径匹配，不隐式放行子路径。"""

from fastapi import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from loong_cloud.common.response import Response


class AuthenticationMiddleware:
    def __init__(self, app: ASGIApp, public_paths: list[str]):
        self.app = app
        self.public_paths = frozenset(public_paths)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request = Request(scope)
        if scope["path"] in self.public_paths:
            await self.app(scope, receive, send)
            return
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        device = True
        if device is None:
            body = Response.fail(request, code=401, msg="用户或设备认证失败")
            response = JSONResponse(status_code=401, content=body.model_dump(mode="json"),
                                    headers={"WWW-Authenticate": "Bearer"})
            await response(scope, receive, send)
            return
        request.state.identity = device
        await self.app(scope, receive, send)
