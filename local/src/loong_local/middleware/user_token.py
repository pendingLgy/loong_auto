"""校验除健康检查与公共转发外的请求是否携带用户身份令牌。"""
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from loong_contracts.utils import Response
from loong_contracts.utils.datetime_util import utcnow
from loong_contracts.utils.uuid_util import uuid_str

# 登录、注册与健康检查不要求用户身份。
EXEMPT_PREFIXES = (
    "/api/health",
    "/api/cloud/common",
)


def _is_exempt(path: str) -> bool:
    return any(path == prefix or path.startswith(f"{prefix}/") for prefix in EXEMPT_PREFIXES)


class UserTokenMiddleware:
    """从 ``X-User-Token`` 读取用户身份，缺失时返回用户身份错误。"""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or _is_exempt(scope["path"]):
            await self.app(scope, receive, send)
            return

        request = Request(scope)

        user_token = request.headers.get("x-user-token", "").strip()
        if not user_token:
            body = Response.fail(
                request,
                code=status.HTTP_401_UNAUTHORIZED,
                msg="用户身份错误",
            )
            response = JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content=body.model_dump(mode="json"),
            )
            await response(scope, receive, send)
            return

        request.state.user_token = user_token
        await self.app(scope, receive, send)
