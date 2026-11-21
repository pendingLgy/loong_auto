"""供应商配置与模型启用配置接口。"""
import httpx
from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Query, Request
from loguru import logger
from loong_contracts.response import BaseResponse
from loong_contracts.response.supplier import SupplierProviderResponse
from loong_contracts.utils import Response

from loong_local.commons.rebuild_header import rebuild_cloud_request_header
from loong_local.core.context import SSEContext
from loong_local.core.exceptions import CloudHttpError
from loong_local.schema.model import (
    SupplierConfigModel,
    SupplierConfigResponse,
    SupplierModelOptionModel,
    SupplierModelOptionResponse,
)
from loong_local.schema.request import SupplierConfigSaveRequest, SupplierModelOptionSaveRequest
from loong_local.service.supplier_config_service import SupplierConfigService

router = APIRouter(prefix="/supplier-configs", tags=["供应商配置"])


def _to_config_response(provider: str, popular: bool, cloud_base_url: str,
                        config: SupplierConfigModel | None) -> SupplierConfigResponse:
    return SupplierConfigResponse(
        id=config.id if config is not None and config.id is not None else 0,
        provider=provider,
        base_url=config.base_url if config is not None and config.base_url else cloud_base_url,
        popular=popular,
        config_flag=config is not None,
        created_at=config.created_at if config is not None else None,
        updated_at=config.updated_at if config is not None else None,
    )


def _to_option_response(option: SupplierModelOptionModel) -> SupplierModelOptionResponse:
    return SupplierModelOptionResponse(
        id=option.id or 0,
        provider=option.provider,
        model=option.model,
        enabled=option.enabled,
        created_at=option.created_at,
        updated_at=option.updated_at,
    )


@router.get("", response_model=BaseResponse[list[SupplierConfigResponse]])
@inject
async def list_supplier_configs(
        request: Request,
        store: SupplierConfigService = Depends(Provide["SupplierConfigService"]),
):
    context: SSEContext = request.state.sse_context
    cloud_client = context.cloud_client

    # 请求体会被重新序列化（SecretStr 脱敏字段还原、字段补全），长度与原请求不同，
    # 不能透传 content-length，否则云端按旧长度截断请求体，报 "There was an error parsing the body"。
    headers = httpx.Headers(request.headers)
    rebuild_cloud_request_header(headers,context.headers())


    try:
        cloud_client.http.headers = headers
        result: BaseResponse = await cloud_client.supplier.get()
        logger.info("path={} status={}", request.url.path, result.code,
                    request_id=result.request_id,
                    request_date=result.request_date)
        if result.code != 200:
            return Response.fail(request,msg="获取供应商失败")
        if result.data is None or result.data.providers is None:
            return Response.fail(request, msg="暂无供应商提供")

    except httpx.HTTPStatusError as e:
        logger.error(e)
        raise CloudHttpError(status=e.response.status_code, message=e.response.text,
                             headers=e.response.headers)

    cloud_supplier_dict: dict[str, SupplierProviderResponse] = result.data.providers
    configs = await store.list_configs()
    config_by_provider = {item.provider: item for item in configs}

    return Response.ok(request, [
        _to_config_response(
            provider,
            info.popular,
            info.base_url,
            config_by_provider.get(provider),
        )
        for provider, info in cloud_supplier_dict.items()
    ])


@router.put("", response_model=BaseResponse[SupplierConfigResponse])
@inject
async def save_supplier_config(
        request: Request,
        body: SupplierConfigSaveRequest,
        store: SupplierConfigService = Depends(Provide["SupplierConfigService"]),
):
    item = await store.save_config(body.provider, body.api_key, body.base_url)
    return Response.ok(request, _to_config_response(item.provider, False, item.base_url or "", item))


@router.delete("", response_model=BaseResponse[bool])
@inject
async def delete_supplier_config(
        request: Request,
        provider: str = Query(min_length=1),
        store: SupplierConfigService = Depends(Provide["SupplierConfigService"]),
):
    deleted = await store.delete_config(provider)
    if not deleted:
        return Response.fail(request, code=404, msg=f"供应商配置不存在：{provider}")
    return Response.ok(request, True)


@router.get("/options", response_model=BaseResponse[list[SupplierModelOptionResponse]])
@inject
async def list_model_options(
        request: Request,
        provider: str | None = Query(default=None),
        store: SupplierConfigService = Depends(Provide["SupplierConfigService"]),
):
    return Response.ok(request, [_to_option_response(item) for item in await store.list_options(provider)])


@router.put("/options", response_model=BaseResponse[SupplierModelOptionResponse])
@inject
async def save_model_option(
        request: Request,
        body: SupplierModelOptionSaveRequest,
        store: SupplierConfigService = Depends(Provide["SupplierConfigService"]),
):
    item = await store.set_option(body.provider, body.model, body.enabled)
    return Response.ok(request, _to_option_response(item))


@router.delete("/options", response_model=BaseResponse[bool])
@inject
async def delete_model_option(
        request: Request,
        provider: str = Query(min_length=1),
        model: str = Query(min_length=1),
        store: SupplierConfigService = Depends(Provide["SupplierConfigService"]),
):
    deleted = await store.delete_option(provider, model)
    if not deleted:
        return Response.fail(request, code=404, msg=f"模型配置不存在：{provider}/{model}")
    return Response.ok(request, True)
