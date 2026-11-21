"""模型供应商目录接口。"""

from fastapi import APIRouter, Request
from loong_contracts.response import BaseResponse
from loong_contracts.response.supplier import SupplierModelResponse, SupplierProviderResponse, SupplierResponse
from loong_contracts.utils import Response

from loong_cloud.agent.supply.supplier import ModelSupplier

router = APIRouter(prefix="/supplier", tags=["模型供应商"])


def _visible_supplier(supplier: ModelSupplier) -> SupplierResponse:
    """按 view 过滤模型；没有可见模型的厂商一并移除。"""
    providers = {}
    for name, provider in supplier.providers.items():
        models = {
            model_name: SupplierModelResponse(
                view=model.view,
                enable=model.enable,
                reasoning_effort=model.reasoning_effort,
            )
            for model_name, model in provider.models.items()
            if model.view
        }
        if models:
            providers[name] = SupplierProviderResponse(
                base_url=provider.base_url,
                timeout=provider.timeout,
                adapter=provider.adapter,
                models=models,
            )
    return SupplierResponse(providers=providers)


@router.get("", response_model=BaseResponse[SupplierResponse], summary="获取模型供应商目录")
async def get_supplier(request: Request) -> BaseResponse[SupplierResponse]:
    """返回 app.state.supplier 中 view=True 的厂商与模型。"""
    supplier: ModelSupplier = request.app.state.supplier
    return Response.ok(request, _visible_supplier(supplier))
