"""普通接口透明转发，不介入审批与消息编排。"""
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Request
from loguru import logger
from starlette.responses import Response

from ..core.context import SSEContext

router = APIRouter(prefix="/common", tags=["公共接口转发"])

@router.api_route("/{target:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def proxy_common(request: Request, target: str):

    context: SSEContext = request.state.sse_context

    cloud_client = context.cloud_client

    headers = httpx.Headers(request.headers)
    headers.update(context.headers())

    outgoing = cloud_client.build_request(request.method, quote(target),
                                          headers=headers, content=request.stream())

    upstream = await cloud_client.send(outgoing, stream=False)

    try:
        log = logger.bind(
            request_id=upstream.headers.get("x-request-id", "-"),
            request_date=upstream.headers.get("x-request-date", "-")
        )
        log.info("path={} status={}", request.url.path, upstream.status_code)

        content = await upstream.aread()

        # httpx 的 Headers 对象的 items() 返回的是 str 类型
        response_headers = {k: v for k, v in upstream.headers.items()}

        response = Response(
            content=content,
            status_code=upstream.status_code,
            headers=dict(response_headers)
        )

        response.headers["X-Local-Request-ID"] = context.local_request_id

        return response

    finally:
        # 8. 确保无论成功还是异常，都关闭 upstream 响应连接
        await upstream.aclose()
