"""消息提交入口；认证、自动拒绝及上下文补齐交由应用服务。"""

import httpx
from fastapi import APIRouter, Request
from loguru import logger
from loong_contracts.request.message import AddMessageRequest
from loong_contracts.response import BaseResponse

from loong_local.core.context import SSEContext

router = APIRouter(prefix="/session", tags=["消息提交接口转发"])


@router.api_route("/{session_id}/message", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
async def submit_message(request: Request, session_id: str, body: AddMessageRequest):
    context: SSEContext = request.state.sse_context

    cloud_client = context.cloud_client

    # 请求体会被重新序列化（SecretStr 脱敏字段还原、字段补全），长度与原请求不同，
    # 不能透传 content-length，否则云端按旧长度截断请求体，报 "There was an error parsing the body"。
    headers = httpx.Headers(request.headers)
    for name in ("content-length", "content-type", "host", "connection", "transfer-encoding"):
        headers.pop(name, None)
    headers.update(context.headers())

    try:
        result: BaseResponse = await cloud_client.events.submit(context.client_id, session_id, body=body, headers=headers)
        logger.info("path={} status={}", request.url.path, result.code,
                    request_id=result.request_id,
                    request_date=result.request_date)

    except httpx.HTTPStatusError as e:
        logger.error(e)
        raise e

    return result
