"""统一异步接口与 HTTP 生命周期。"""

import json
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any

import httpx
from loguru import logger
from loong_contracts.agent.models import Message, ModelRequest, ToolCall

from loong_cloud.agent.adapters.connection import ProviderConnection
from loong_cloud.config.config_model import ModelConfig


class ModelError(RuntimeError):
    """不暴露上游响应内容或凭证的模型调用异常。"""


class ModelAdapter(ABC):
    def __init__(self, config: ModelConfig, client: httpx.AsyncClient | None = None,
                 provider_config: ProviderConnection | None = None):
        self.config = config

        if provider_config is None:
            raise ValueError("供应商未在模型目录中配置连接信息")
        self.connection = provider_config
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(timeout=self.connection.timeout)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        await self.close()

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    @staticmethod
    def _tool_call(request: ModelRequest, call_id: str, name: str, arguments: dict[str, Any]) -> ToolCall:
        for tool in request.tools:
            if tool.name == name:
                return ToolCall(id=call_id, name=name, arguments=arguments, location=tool.location)
        raise ModelError("模型返回了未注册的工具调用")

    async def _post(self, path: str, body: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
        response = None
        try:
            response = await self._client.post(
                f"{self.connection.base_url}/{path}", json=body, headers=headers,
                timeout=self.connection.timeout,
            )
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError("模型响应必须为对象")
            return data
        except (httpx.HTTPError, ValueError) as exc:
            if response:
                logger.error(f"http status:{response.status_code}, msg:{response.text}")
            # 上游异常可能含敏感 URL/正文；使用经过清理的异常打印堆栈。
            error = ModelError(f"模型请求失败（{self.config.provider}，{type(exc).__name__}）")
            logger.opt(exception=(ModelError, error, exc.__traceback__)).error("模型调用失败" + response)
            raise error from None

    @abstractmethod
    async def complete(self, request: ModelRequest, config: ModelConfig | None = None) -> Message:
        """返回文本和带执行位置的工具调用；适配器不执行工具。"""

    @abstractmethod
    def stream(self, request: ModelRequest, config: ModelConfig | None = None) -> AsyncIterator[Message]:
        """增量返回文本；工具参数组装完整后才返回工具调用。"""

    async def _stream_post(self, path, body, headers):
        """解析 SSE data 多行、注释及结束标记，退出时关闭连接。"""
        body = {**body, "stream": True}
        headers = {**headers, "Accept": "text/event-stream"}
        try:
            async with self._client.stream(
                "POST", f"{self.connection.base_url}/{path}", json=body,
                headers=headers, timeout=self.connection.timeout,
            ) as response:
                response.raise_for_status()
                lines = []
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        lines.append(line[5:].removeprefix(" "))
                    elif not line and lines:
                        raw = "\n".join(lines)
                        lines.clear()
                        if raw == "[DONE]":
                            return
                        data = json.loads(raw)
                        if not isinstance(data, dict) or "error" in data or data.get("type") == "error":
                            raise ValueError("上游流式响应异常")
                        yield data
                if lines:
                    raise ValueError("SSE 帧未完整结束")
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
            error = ModelError(f"模型流式请求失败（{self.config.provider}，{type(exc).__name__}）{str(exc)}")
            logger.opt(exception=(ModelError, error, exc.__traceback__)).error("模型流式调用失败")
            raise error from None
