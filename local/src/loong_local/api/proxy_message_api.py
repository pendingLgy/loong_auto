"""消息提交入口；认证、自动拒绝及上下文补齐交由应用服务。"""

import httpx
from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Request
from loguru import logger

from loong_contracts.agent.models import ToolDefinition
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest
from loong_contracts.response import BaseResponse
from loong_contracts.utils import Response
from pydantic import SecretStr

from loong_local.commons.rebuild_header import rebuild_cloud_request_header
from loong_local.core.context import SSEContext
from loong_local.core.exceptions import CloudHttpError
from loong_local.service.supplier_config_service import SupplierConfigService
from loong_local.tools import GLOBAL_TOOL_REGISTRY

router = APIRouter(prefix="/session", tags=["消息提交接口转发"])


@router.api_route("/{session_id}/message", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
@inject
async def submit_message(request: Request, session_id: str, body: AddMessageRequest,
                         supplier_config_service: SupplierConfigService = Depends(Provide["SupplierConfigService"])):
    context: SSEContext = request.state.sse_context

    cloud_client = context.cloud_client

    # 请求体会被重新序列化（SecretStr 脱敏字段还原、字段补全），长度与原请求不同，
    # 不能透传 content-length，否则云端按旧长度截断请求体，报 "There was an error parsing the body"。
    headers = httpx.Headers(request.headers)
    rebuild_cloud_request_header(headers, context.headers())

    llm:LLMParamRequest = body.llm
    if llm.api_key is None:
        api_key = await supplier_config_service.get_api_key(llm.provider)
        if api_key is None:
            return Response.fail(request,msg="未配置api_key")
        llm.api_key = SecretStr(api_key)

    all_tools:list[ToolDefinition] = GLOBAL_TOOL_REGISTRY.get_all_definitions()

    body.tools = all_tools
    body.enable_summary = request.app.state.global_config.enable_summary
    try:
        result: BaseResponse = await cloud_client.events.submit(
            context.client_id, session_id, body=body, headers=headers
        )
        logger.info("path={} status={}", request.url.path, result.code,
                    request_id=result.request_id,
                    request_date=result.request_date)

    except httpx.HTTPStatusError as e:
        raise CloudHttpError(status=e.response.status_code, message=e.response.text,headers=e.response.headers)

    return result
