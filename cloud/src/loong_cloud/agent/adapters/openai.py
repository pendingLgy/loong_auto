"""OpenAI Chat Completions 协议及兼容供应商。"""

import json

from .base import ModelAdapter, ModelError
from loong_cloud.config.config_model import ModelConfig
from ..models import Message, ModelRequest, ModelResponse, ToolCall
from ..models import ModelStreamEvent
from contextlib import aclosing


class OpenAIAdapter(ModelAdapter):
    async def stream(self, request: ModelRequest, config: ModelConfig | None = None):
        config = config or self.config
        body, headers = self._prepare(request, config)
        body["stream_options"] = {"include_usage": True}
        text, pending = [], {}
        chunks = []
        model, finish, usage = config.model, None, {}
        try:
            async with aclosing(self._stream_post("chat/completions", body, headers)) as events:
                async for data in events:
                    chunks.append(data)
                    model = data.get("model", model)
                    usage = data.get("usage") or usage
                    for choice in data.get("choices", []):
                        if choice.get("index", 0) != 0:
                            continue
                        finish = choice.get("finish_reason") or finish
                        delta = choice.get("delta") or {}
                        if delta.get("content"):
                            text.append(delta["content"])
                            yield ModelStreamEvent(type="text_delta", text=delta["content"])
                        for part in delta.get("tool_calls", []):
                            call = pending.setdefault(part["index"], {"id": "", "name": "", "arguments": ""})
                            call["id"] += part.get("id") or ""
                            function = part.get("function") or {}
                            call["name"] += function.get("name") or ""
                            call["arguments"] += function.get("arguments") or ""
            if finish is None:
                raise ModelError("模型流在完成前中断")
            calls = [self._tool_call(request, call["id"], call["name"], json.loads(call["arguments"]))
                     for _, call in sorted(pending.items())]
            for call in calls:
                yield ModelStreamEvent(type="tool_call", tool_call=call)
            token_usage = dict(
                input_tokens=usage.get("prompt_tokens", 0),
                output_tokens=usage.get("completion_tokens", 0),
                total_tokens=usage.get("total_tokens", usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)),
            )
            yield ModelStreamEvent(type="done", response=ModelResponse(
                model=model, message=Message(role="assistant", content="".join(text), tool_calls=calls,
                                raw={"chunks": chunks}, status=finish, type="tool_calls" if calls else "text", **token_usage),
                finish_reason=finish, **token_usage,
                raw={"chunks": chunks},
            ))
        except (KeyError, IndexError, TypeError, ValueError):
            raise ModelError("OpenAI 兼容接口返回了无效流式响应") from None

    def _prepare(self, request: ModelRequest, config: ModelConfig | None = None):
        config = config or self.config
        temperature = request.temperature if request.temperature is not None else config.temperature
        messages = []
        for message in request.messages:
            item = {"role": message.role, "content": message.content}
            if message.tool_calls:
                item["tool_calls"] = [
                    {"id": call.id, "type": "function", "function": {
                        "name": call.name, "arguments": json.dumps(call.arguments, ensure_ascii=False),
                    }} for call in message.tool_calls
                ]
            if message.role == "tool":
                if not message.tool_call_id:
                    raise ValueError("工具结果必须指定 tool_call_id")
                item["tool_call_id"] = message.tool_call_id
            messages.append(item)
        body = {"model": config.model, "messages": messages, "max_tokens": request.max_tokens}
        if temperature is not None:
            body["temperature"] = temperature
        if request.tools:
            body["tools"] = [{"type": "function", "function": tool.model_dump(exclude={"location"})}
                             for tool in request.tools]
        headers = {}
        if config.api_key:
            headers["Authorization"] = f"Bearer {config.api_key.get_secret_value()}"
        return body, headers

    async def complete(self, request: ModelRequest, config: ModelConfig | None = None) -> ModelResponse:
        config = config or self.config
        body, headers = self._prepare(request, config)
        data = await self._post("chat/completions", body, headers)
        try:
            choice = data["choices"][0]
            message = choice["message"]
            calls = [self._tool_call(request, call_id=call["id"], name=call["function"]["name"],
                              arguments=json.loads(call["function"]["arguments"]))
                     for call in message.get("tool_calls", [])]
            usage = data.get("usage") or {}
            token_usage = dict(
                input_tokens=usage.get("prompt_tokens", 0),
                output_tokens=usage.get("completion_tokens", 0),
                total_tokens=usage.get("total_tokens", usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)),
            )
            return ModelResponse(
                message=Message(model=data.get("model", config.model),
                                role="assistant",
                                content=message.get("content") or "",
                                tool_calls=calls,
                                raw=data,
                                status=choice.get("finish_reason"),
                                type="tool_calls" if calls else "text", **token_usage),
            )
        except (KeyError, IndexError, TypeError, ValueError):
            raise ModelError("OpenAI 兼容接口返回了无效响应") from None
