"""限制本地 Host 和浏览器来源。"""
from loong_contracts.utils import Response
from loong_contracts.utils.datetime_util import utcnow
from loong_contracts.utils.uuid_util import uuid_str
from starlette import status
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


class LocalAccessMiddleware:
    def __init__(self, app: ASGIApp, allowed_hosts: list[str]):
        self.app, self.allowed_hosts = app, frozenset(allowed_hosts)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            request = Request(scope)
            # 本中间件在 SessionMiddleware 之前执行，拒绝响应也需要请求上下文。
            if not hasattr(request.state, "request_id"):
                request.state.request_id = uuid_str()
            if not hasattr(request.state, "request_date"):
                request.state.request_date = utcnow()

            if request.url.hostname not in self.allowed_hosts:
                body = Response.fail(request, code=status.HTTP_400_BAD_REQUEST, msg="不允许的 Host")
                response = JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=body.model_dump(mode="json"))
                await response(scope, receive, send)
                return

            if request.app.state.enable_security_token:
                security_token = request.headers.get("x-security-token", "")
                if security_token != request.app.state.security_token:
                    body = Response.fail(request, code=status.HTTP_403_FORBIDDEN,
                                         msg="Security Token错误")
                    response = JSONResponse(status_code=status.HTTP_403_FORBIDDEN,
                                            content=body.model_dump(mode="json"))
                    await response(scope, receive, send)
                    return

        await self.app(scope, receive, send)
