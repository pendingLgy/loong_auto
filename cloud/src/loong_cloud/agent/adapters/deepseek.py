"""DeepSeek 的 OpenAI 兼容 Chat Completions 接口。"""

from loong_cloud.config.config_model import ModelConfig
from loong_contracts.agent.models import ModelRequest, Message
from .openai import OpenAIAdapter


class DeepSeekAdapter(OpenAIAdapter):
    def _prepare(self, request: ModelRequest, config: ModelConfig | None = None):
        config = config or self.config
        if not config.api_key or not config.api_key.get_secret_value().strip():
            raise ValueError("DeepSeek 需要配置 api_key")
        return super()._prepare(request, config)

    async def complete(self, request: ModelRequest, config: ModelConfig | None = None) -> Message:
        config = config or self.config
        if not config.api_key or not config.api_key.get_secret_value().strip():
            raise ValueError("DeepSeek 需要配置 api_key")
        return await super().complete(request, config)
