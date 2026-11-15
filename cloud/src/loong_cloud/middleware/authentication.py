"""HTTP Bearer 认证；白名单支持大小写敏感的 glob 路径匹配。"""

from fnmatch import translate
import re

from fastapi import HTTPException, Request
from starlette import status
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from loong_cloud.common.response import Response
from loong_cloud.storage.token_service import TokenService
from loong_cloud.storage.user_store import UserStore
from loong_contracts.response.login import UserInfoResponse


class AuthenticationMiddleware:
    def __init__(self, app: ASGIApp, public_paths: list[str], token_service: TokenService, user_store: UserStore):
        self.app = app
        self.token_service = token_service
        self.user_store = user_store
        self.public_paths = frozenset(public_paths)
        self._public_path_patterns = tuple(re.compile(translate(path)) for path in self.public_paths)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request = Request(scope)

        if any(pattern.fullmatch(scope["path"]) for pattern in self._public_path_patterns):
            await self.app(scope, receive, send)
            return

        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        try:
            if scheme.lower() != "bearer" or not token or " " in token:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "缺少有效的 Bearer 令牌")
            identity:UserInfoResponse = await self.token_service.authenticate(token)
        except HTTPException as exc:
            body = Response.fail(request, code=exc.status_code, msg=exc.detail)
            response = JSONResponse(status_code=exc.status_code, content=body.model_dump(mode="json"),
                                    headers={"WWW-Authenticate": "Bearer"})
            await response(scope, receive, send)
            return

        #登录过的用户使用登录信息的tenant_id覆盖tenant_resolve解析出来的tenant_id
        request.state.tenant = identity.tenant_id
        request.state.identity = identity
        request.state.access_token = token

        await self.app(scope, receive, send)
