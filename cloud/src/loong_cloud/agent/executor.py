"""按配置别名路由模型调用；不负责工具执行或 Agent 循环。"""

from contextlib import aclosing
from importlib.resources import files
from pathlib import Path

import httpx
import yaml
from pydantic import BaseModel, Field

from loong_cloud.agent.adapters.connection import ProviderConnection
from loong_cloud.config.config_model import ModelConfig
from .adapters import ModelAdapter, create_adapter
from loong_contracts.agent.models import ModelRequest, Message


class _CatalogModel(BaseModel):
    """模型目录条目，后续可扩展模型能力。"""


class _CatalogProvider(ProviderConnection):
    adapter: str = Field(min_length=1)
    models: dict[str, _CatalogModel] = Field(default_factory=dict)


class _Catalog(BaseModel):
    providers: dict[str, _CatalogProvider] = Field(default_factory=dict)


class ModelExecutor:
    """一个实例在同一个事件循环中使用，结束时调用 close()。

    调用传入 ModelConfig，按 provider/model 查询 YAML，再按供应商 adapter 选择协议。
    外部传入的 HTTP 客户端由调用方关闭。
    """

    def __init__(self, client: httpx.AsyncClient | None = None,
                 catalog_path: str | Path | None = None):
        content = (Path(catalog_path).read_text(encoding="utf-8") if catalog_path is not None
                   else files("loong_cloud.agent.adapters").joinpath("default_models.yaml").read_text(encoding="utf-8"))
        self._catalog = _Catalog.model_validate(yaml.safe_load(content))
        self._client = client
        self._owns_client = client is None
        self._adapters: dict[str, ModelAdapter] = {}
        self._closed = False

    async def __aenter__(self) -> "ModelExecutor":
        if self._closed:
            raise RuntimeError("模型执行器已关闭")
        return self

    async def __aexit__(self, exc_type, exc, traceback) -> None:
        await self.close()

    def _get_adapter(self, config: ModelConfig) -> ModelAdapter:
        if self._closed:
            raise RuntimeError("模型执行器已关闭")
        provider = self._catalog.providers.get(config.provider)
        if provider is None:
            raise ValueError("供应商未在模型目录中配置")
        model = provider.models.get(config.model)
        if model is None:
            raise ValueError("模型未在该供应商目录中配置")
        values = provider.model_dump(include={"base_url", "timeout"})
        connection = ProviderConnection.model_validate(values)
        key = config.provider
        if self._client is None:
            self._client = httpx.AsyncClient()
        if key not in self._adapters:
            self._adapters[key] = create_adapter(
                config.model_copy(deep=True, update={"api_key": None}), self._client, connection,
                adapter=provider.adapter,
            )
        return self._adapters[key]

    async def complete(self, config: ModelConfig, request: ModelRequest) -> Message:
        """选择模型配置，复用对应适配器并返回统一响应。"""
        return await self._get_adapter(config).complete(request, config)

    async def stream(self, config: ModelConfig, request: ModelRequest):
        async with aclosing(self._get_adapter(config).stream(request, config)) as events:
            async for event in events:
                yield event

    async def stream_sse(self, config: ModelConfig, request: ModelRequest):
        """用于 StreamingResponse(..., media_type='text/event-stream')。"""
        async with aclosing(self.stream(config, request)) as events:
            async for event in events:
                yield event.to_sse()

    async def close(self) -> None:
        """调用方须先结束正在执行的请求，再关闭执行器。"""
        if self._closed:
            return
        if self._owns_client and self._client is not None:
            await self._client.aclose()
        self._adapters.clear()
        self._closed = True
