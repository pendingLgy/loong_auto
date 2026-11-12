"""HTTP Bearer 认证；白名单仅按完整路径匹配，不隐式放行子路径。"""

from fastapi import HTTPException, Request
from starlette import status
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from loong_cloud.common.response import Response
from loong_cloud.storage.token_service import TokenService
from loong_cloud.storage.user_store import UserStore


class AuthenticationMiddleware:
    def __init__(self, app: ASGIApp, public_paths: list[str], token_service: TokenService, user_store: UserStore):
        self.app = app
        self.token_service = token_service
        self.user_store = user_store
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
        try:
            if scheme.lower() != "bearer" or not token or " " in token:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "缺少有效的 Bearer 令牌")
            identity = await self.token_service.authenticate(token)
        except HTTPException as exc:
            body = Response.fail(request, code=exc.status_code, msg=exc.detail)
            response = JSONResponse(status_code=exc.status_code, content=body.model_dump(mode="json"),
                                    headers={"WWW-Authenticate": "Bearer"})
            await response(scope, receive, send)
            return
        request.state.identity = identity
        request.state.access_token = token

        await self.app(scope, receive, send)
