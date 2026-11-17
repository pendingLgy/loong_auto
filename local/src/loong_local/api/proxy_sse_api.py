"""SSE 订阅入口，持久化事件支持 Last-Event-ID；不在回放时执行工具。"""
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Request
from starlette.responses import Response, StreamingResponse

from ..core.context import SSEContext
from ..core.logging import log_exception

router = APIRouter(prefix="/sse", tags=["sse订阅转发"])


@router.get("/subscribe")
async def subscribe(request: Request):
    context: SSEContext = request.state.sse_context
    cloud_client = context.cloud_client

    # 保留客户端原始请求头（含 Last-Event-ID），再补充网关身份头。
    headers = httpx.Headers(request.headers)
    headers.update(context.headers())

    cloud_client.http.headers = headers

    # 1. 直接获取上游打开的 response 句柄
    try:
        upstream_response = await cloud_client.events.subscribe(context.client_id)
    except Exception as e:
        return Response(content=f"Upstream connect failed: {str(e)}", status_code=502)

    # 2. 定义流式生成器：生命周期完全由 generator 的 finally 托管
    async def generate_proxy_stream():
        try:
            async for chunk in upstream_response.aiter_bytes():
                yield chunk
        except Exception as e:
            # 记录异常或直接抛出
            raise e
        finally:
            # 【关键】无论客户端断开、流读取完成、还是发生异常，这里都会安全关闭上游连接
            await upstream_response.aclose()

    return StreamingResponse(
        generate_proxy_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Local-Request-ID": context.local_request_id,
            "X-Request-ID": upstream_response.headers.get("x-request-id", "-"),
            "X-Request-Date": upstream_response.headers.get("x-request-date", "-"),
        }
    )