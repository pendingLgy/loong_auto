"""固定上游 HTTP 转发，保持 SSE 原始帧且不自动重试有副作用请求。"""
from loguru import logger
from uuid import uuid4

import httpx
from fastapi import APIRouter, Request
from starlette.background import BackgroundTask
from starlette.responses import JSONResponse, StreamingResponse

from loong_cloud_client import CloudClient

router = APIRouter()
HOP_HEADERS = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length"}


def headers_without_hops(headers):
    blocked = HOP_HEADERS | {item.strip().lower() for item in headers.get("connection", "").split(",")}
    items = headers.multi_items() if isinstance(headers, httpx.Headers) else headers.items()
    return [(key, value) for key, value in items if key.lower() not in blocked]


@router.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def forward(request: Request, path: str):
    client:CloudClient = request.app.state.cloud_client
    config = request.app.state.gateway_config
    local_request_id = uuid4().hex
    # 云端响应到达前尚无云端上下文，不生成替代的 request_id/request_date。
    request_logger = logger.bind(local_request_id=local_request_id).patch(
        lambda record: record.update(message=f"path={request.url.path} | {record['message']}")
    )
    # 使用原始路径并固定 scheme/host，不允许客户端选择上游地址。
    url = httpx.URL(str(config.cloud_url)).copy_with(
        raw_path=request.scope.get("raw_path", request.url.path.encode()) +
        (b"?" + request.scope["query_string"] if request.scope["query_string"] else b""),
    )
    headers = headers_without_hops(request.headers)
    headers = [(k, v) for k, v in headers if k.lower() != "x-local-request-id"]
    headers.append(("X-Local-Request-ID", local_request_id))
    request_logger.info("method={} forwarding", request.method)
    try:
        outgoing = client.build_request(request.method, url.raw_path.decode("ascii"), headers=headers, content=request.stream())
        upstream = await client.send(outgoing, stream=True)
        request_logger = request_logger.bind(
            request_id=upstream.headers.get("X-Request-ID", "-"),
            request_date=upstream.headers.get("X-Request-Date", "-"),
        )
        request_logger.info("status={}", upstream.status_code)
    except httpx.TimeoutException:
        request_logger.exception("cloud timeout")
        return JSONResponse({"code": 504, "msg": "云端请求超时", "data": None}, status_code=504)
    except httpx.HTTPError:
        request_logger.exception("cloud unavailable")
        return JSONResponse({"code": 502, "msg": "无法连接云端服务", "data": None}, status_code=502)

    async def body():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        except httpx.HTTPError:
            request_logger.exception("cloud stream interrupted")
            raise
        finally:
            await upstream.aclose()
            request_logger.info("stream closed")

    response = StreamingResponse(body(), status_code=upstream.status_code,
                                 background=BackgroundTask(upstream.aclose))
    response.raw_headers = [(key.encode("latin-1"), value.encode("latin-1"))
                            for key, value in headers_without_hops(upstream.headers)]
    response.headers["X-Local-Request-ID"] = local_request_id
    if upstream.headers.get("content-type", "").startswith("text/event-stream"):
        response.headers["Cache-Control"] = "no-cache"
        response.headers["X-Accel-Buffering"] = "no"
    return response
