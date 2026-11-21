"""根据协议创建适配器；兼容供应商通过 base_url 切换。"""

import httpx

from loong_cloud.agent.adapters.base import ModelAdapter, ModelError
from loong_cloud.agent.adapters.connection import ProviderConnection
from loong_cloud.agent.adapters.deepseek import DeepSeekAdapter
from loong_cloud.agent.adapters.openai import OpenAIAdapter
from loong_cloud.config.config_model import ModelConfig


def create_adapter(config: ModelConfig, client: httpx.AsyncClient | None = None,
                   provider_config: ProviderConnection | None = None, *,
                   adapter: str | None = None) -> ModelAdapter:
    adapters = {"openai": OpenAIAdapter, "deepseek": DeepSeekAdapter}
    name = adapter or config.provider
    if name not in adapters:
        raise ValueError("模型配置指定了不支持的适配器")
    return adapters[name](config, client, provider_config)


__all__ = ["create_adapter", "ModelAdapter", "ModelError", "OpenAIAdapter", "DeepSeekAdapter"]
