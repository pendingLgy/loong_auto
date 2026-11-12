from fastapi import Request
from starlette.types import ASGIApp, Receive, Scope, Send


class TenantResolveMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)

        host_header = request.headers.get("host", "")
        domain = host_header.split(":")[0].lower()

        request.state.tenant_id = 0
        await self.app(scope, receive, send)
