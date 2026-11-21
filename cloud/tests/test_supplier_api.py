"""供应商目录接口测试：执行前必须单独启动 cloud 服务。

运行：python -m pytest cloud/tests/test_supplier_api.py -v -s
"""
import httpx
from loong_cloud_client.client import CloudClient
from loong_contracts.response.supplier import SupplierModelResponse, SupplierProviderResponse, SupplierResponse


async def test_get_supplier_filters_hidden_models(client):
    cloud = CloudClient(client)
    result = await cloud.supplier.get()

    assert result.code == 200
    assert isinstance(result.data, SupplierResponse)

    print(f"\n{result.model_dump_json(ensure_ascii=False)}")
    for provider in result.data.providers.values():
        assert isinstance(provider, SupplierProviderResponse)
        assert provider.models, "没有可见模型的厂商不应返回"
        assert provider.base_url
        assert provider.adapter

        for model in provider.models.values():
            assert isinstance(model, SupplierModelResponse)
            assert model.view is True, "view=false 的模型不应返回"
            assert isinstance(model.enable, bool)
            assert isinstance(model.reasoning_effort, list)


async def test_supplier_requires_auth(settings):
    async with httpx.AsyncClient(
        base_url=settings("MESSAGE_API_BASE_URL", "http://127.0.0.1:9527"),
        timeout=10,
    ) as http:
        response = await http.get("/api/supplier")


    assert response.status_code == 401
