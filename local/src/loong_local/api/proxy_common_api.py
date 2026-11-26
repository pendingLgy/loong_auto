"""普通接口透明转发，不介入审批与消息编排。"""
import json
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Request
from httpx import ConnectError, Headers
from loguru import logger
from starlette import status
from starlette.responses import Response

from loong_local.commons.rebuild_header import rebuild_cloud_request_header
from loong_local.core.context import SSEContext
from loong_local.core.exceptions import CloudHttpError

router = APIRouter(prefix="/common", tags=["公共接口转发"])




@router.api_route("/{target:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def proxy_common(request: Request, target: str):

    context: SSEContext = request.state.sse_context

    cloud_client = context.cloud_client

    headers = httpx.Headers(request.headers)
    rebuild_cloud_request_header(headers, context.headers())

    query = list(request.query_params.multi_items())
    outgoing = cloud_client.build_request(request.method, quote(target),
                                          headers=headers,
                                          params=query or None,
                                          content=request.stream())

    upstream = None
    try:

        upstream = await cloud_client.send(outgoing, stream=False)

        logger.info("path={} status={}", request.url.path, upstream.status_code,
                 request_id=upstream.headers.get("x-request-id", "-"),
                request_date=upstream.headers.get("x-request-date", "-"))

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
    except httpx.HTTPStatusError as e:
        raise CloudHttpError(status=e.response.status_code, message=e.response.text,headers=e.response.headers)
    except Exception as e:
        if isinstance(e,ConnectError):
            error_obj = {
                "msg":"网络连接异常"
            }
            msg = json.dumps(error_obj,ensure_ascii=False)
            raise CloudHttpError(status=status.HTTP_500_INTERNAL_SERVER_ERROR, message=msg,headers=Headers())
        raise e

    finally:
        # 8. 确保无论成功还是异常，都关闭 upstream 响应连接
        if upstream:
            try:
                await upstream.aclose()
            except Exception as e:
                logger.error("close cloud request error",str(e))
            finally:
                pass
