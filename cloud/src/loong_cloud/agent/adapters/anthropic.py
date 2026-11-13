"""Anthropic Messages 协议适配。"""

from .base import ModelAdapter, ModelError
from loong_cloud.config.config_model import ModelConfig
from ..models import Message, ModelRequest, ModelResponse, ToolCall
from ..models import ModelStreamEvent
from contextlib import aclosing
import json


class AnthropicAdapter(ModelAdapter):
    async def stream(self, request: ModelRequest, config: ModelConfig | None = None):
        config = config or self.config
        body, headers = self._prepare(request, config)
        text, pending = [], {}
        chunks = []
        model, finish, usage, stopped = config.model, None, {}, False
        try:
            async with aclosing(self._stream_post("messages", body, headers)) as events:
                async for data in events:
                    chunks.append(data)
                    kind = data.get("type")
                    if kind == "message_start":
                        model = data["message"].get("model", model)
                        usage.update(data["message"].get("usage") or {})
                    elif kind == "content_block_start":
                        block = data["content_block"]
                        if block["type"] == "tool_use":
                            pending[data["index"]] = {**block, "arguments": ""}
                        elif block["type"] == "text" and block.get("text"):
                            text.append(block["text"])
                            yield ModelStreamEvent(type="text_delta", text=block["text"])
                    elif kind == "content_block_delta":
                        delta = data["delta"]
                        if delta["type"] == "text_delta":
                            text.append(delta["text"])
                            yield ModelStreamEvent(type="text_delta", text=delta["text"])
                        elif delta["type"] == "input_json_delta":
                            pending[data["index"]]["arguments"] += delta["partial_json"]
                    elif kind == "message_delta":
                        finish = data["delta"].get("stop_reason") or finish
                        usage.update(data.get("usage") or {})
                    elif kind == "message_stop":
                        stopped = True
                        break
            if not stopped:
                raise ModelError("模型流在完成前中断")
            calls = [self._tool_call(request, block["id"], block["name"],
                                    json.loads(block["arguments"]) if block["arguments"] else block["input"])
                     for _, block in sorted(pending.items())]
            for call in calls:
                yield ModelStreamEvent(type="tool_call", tool_call=call)
            token_usage = dict(
                input_tokens=usage.get("input_tokens", 0),
                output_tokens=usage.get("output_tokens", 0),
                total_tokens=usage.get("total_tokens", usage.get("input_tokens", 0) + usage.get("output_tokens", 0)),
            )
            yield ModelStreamEvent(type="done", response=ModelResponse(
                model=model, message=Message(role="assistant", content="".join(text), tool_calls=calls,
                                raw={"chunks": chunks}, status=finish, type="tool_calls" if calls else "text", **token_usage),
                finish_reason=finish, **token_usage, raw={"chunks": chunks},
            ))
        except (KeyError, IndexError, TypeError, ValueError):
            raise ModelError("Anthropic 返回了无效流式响应") from None

    def _prepare(self, request: ModelRequest, config: ModelConfig | None = None):
        config = config or self.config
        temperature = request.temperature if request.temperature is not None else config.temperature
        if not config.api_key:
            raise ValueError("Anthropic 需要配置 api_key")
        messages = []
        systems = []
        for message in request.messages:
            if message.role == "system":
                systems.append(message.content)
                continue
            if message.role == "tool":
                if not message.tool_call_id:
                    raise ValueError("工具结果必须指定 tool_call_id")
                role = "user"
                blocks = [{"type": "tool_result", "tool_use_id": message.tool_call_id, "content": message.content}]
            else:
                role = message.role
                blocks = [{"type": "text", "text": message.content}] if message.content else []
                blocks.extend({"type": "tool_use", "id": call.id, "name": call.name, "input": call.arguments}
                              for call in message.tool_calls)
            if messages and messages[-1]["role"] == role:
                messages[-1]["content"].extend(blocks)
            else:
                messages.append({"role": role, "content": blocks})
        body = {"model": config.model, "messages": messages, "max_tokens": request.max_tokens}
        if systems:
            body["system"] = "\n\n".join(systems)
        if temperature is not None:
            if temperature > 1:
                raise ValueError("Anthropic temperature 不能超过 1")
            body["temperature"] = temperature
        if request.tools:
            body["tools"] = [{"name": tool.name, "description": tool.description,
                              "input_schema": tool.parameters} for tool in request.tools]
        return body, {"x-api-key": config.api_key.get_secret_value(), "anthropic-version": "2023-06-01"}

    async def complete(self, request: ModelRequest, config: ModelConfig | None = None) -> ModelResponse:
        config = config or self.config
        body, headers = self._prepare(request, config)
        data = await self._post("messages", body, headers)
        try:
            blocks = data["content"]
            calls = [self._tool_call(request, call_id=block["id"], name=block["name"], arguments=block["input"])
                     for block in blocks if block["type"] == "tool_use"]
            usage = data.get("usage") or {}
            token_usage = dict(
                input_tokens=usage.get("input_tokens", 0),
                output_tokens=usage.get("output_tokens", 0),
                total_tokens=usage.get("total_tokens", usage.get("input_tokens", 0) + usage.get("output_tokens", 0)),
            )
            return ModelResponse(
                raw=data, model=data.get("model", config.model),
                message=Message(
                    role="assistant", content="".join(block["text"] for block in blocks if block["type"] == "text"),
                    tool_calls=calls, raw=data, status=data.get("stop_reason"),
                    type="tool_calls" if calls else "text", **token_usage,
                ),
                finish_reason=data.get("stop_reason"), **token_usage,
            )
        except (KeyError, TypeError, ValueError):
            raise ModelError("Anthropic 返回了无效响应") from None
