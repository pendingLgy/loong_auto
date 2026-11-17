"""固定上游透明转发，保留重复响应头及 cloud 请求上下文。"""
import httpx
from fastapi import Request
from starlette.responses import StreamingResponse
from loguru import logger
from .context import SSEContext

HOP_HEADERS = frozenset({"connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
                         "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length"})


def filtered(headers: httpx.Headers) -> list[tuple[str, str]]:
    blocked = HOP_HEADERS | frozenset(x.strip().lower() for x in headers.get("connection", "").split(","))
    return [(key, value) for key, value in headers.multi_items() if key.lower() not in blocked]


async def forward(request: Request, context: SSEContext) -> StreamingResponse:
    public = context.session_context.headers()
    headers = httpx.Headers(filtered(httpx.Headers(request.headers)))
    headers.update(public)
    raw_path = request.scope.get("raw_path", request.url.path.encode())
    target = raw_path + (b"?" + request.scope["query_string"] if request.scope["query_string"] else b"")
    outgoing = context.service.client.build_request(request.method, target.decode("ascii"),
                                                    headers=headers, content=request.stream())
    upstream = await context.service.client.send(outgoing, stream=True)
    log = logger.bind(request_id=upstream.headers.get("x-request-id", "-"),
                      request_date=upstream.headers.get("x-request-date", "-"))
    log.info("path={} status={}", request.url.path, upstream.status_code)

    async def chunks():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()
    response = StreamingResponse(chunks(), status_code=upstream.status_code)
    response.raw_headers = [(k.encode("latin-1"), v.encode("latin-1")) for k, v in filtered(upstream.headers)]
    response.headers["X-Local-Request-ID"] = context.session_context.local_request_id
    return response
