"""OpenAI Chat Completions 协议及兼容供应商。"""

import json
from contextlib import aclosing

from loong_cloud.config.config_model import ModelConfig
from .base import ModelAdapter, ModelError
from ..models import Message, ModelRequest


class OpenAIAdapter(ModelAdapter):
    async def stream(self, request: ModelRequest, config: ModelConfig | None = None):
        config = config or self.config
        body, headers = self._prepare(request, config)
        body["stream_options"] = {"include_usage": True}
        model, finish, usage = config.model, None, {}
        text, pending, chunks = [], {}, []
        emitted = False
        try:
            async with aclosing(self._stream_post("chat/completions", body, headers)) as events:
                async for data in events:

                    # print(f"data: {json.dumps(data, indent=4, ensure_ascii=False)}")

                    chunks.append(data)
                    response_id = data.get("id")
                    created = data.get("created")
                    model = data.get("model", model)
                    usage = data.get("usage") or usage
                    for choice in data.get("choices", []):
                        if choice.get("index", 0) != 0:
                            continue

                        finish = choice.get("finish_reason") or finish
                        delta = choice.get("delta") or {}
                        content = delta.get("content") or ""

                        text.append(content)

                        yield Message(id=response_id, created=created, model=model,
                                      role="assistant", status="running", finish_reason=finish,
                                      content=content, raw=data)

                        for part in delta.get("tool_calls", []):
                            index = part.get("index", 0)
                            call = pending.setdefault(index, {"id": "", "name": "", "arguments": ""})
                            call["id"] += part.get("id") or ""
                            function = part.get("function") or {}
                            call["name"] += function.get("name") or ""
                            call["arguments"] += function.get("arguments") or ""

                    if finish and not emitted:
                        calls = [self._tool_call(request, item["id"], item["name"],
                                                 json.loads(item["arguments"] or "{}"))
                                 for _, item in sorted(pending.items())]
                        token_usage = {
                            "input_tokens": usage.get("prompt_tokens", 0),
                            "output_tokens": usage.get("completion_tokens", 0),
                            "total_tokens": usage.get("total_tokens", usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)),
                        }
                        emitted = True
                        yield Message(id=response_id, created=created, model=model,
                                      role="assistant", status="stop" if not calls else "tool_calling",
                                      raw=data,
                                      finish_reason=finish, content="".join(text), tool_calls=calls,
                                      **token_usage)

            if finish is None or not emitted:
                raise ModelError("模型流在完成前中断")
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
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.name,
                            "arguments": json.dumps(call.arguments, ensure_ascii=False),
                        }
                    } for call in message.tool_calls
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

    async def complete(self, request: ModelRequest, config: ModelConfig | None = None) -> Message:
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
                total_tokens=usage.get("total_tokens",
                                       usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0)),
            )

            return Message(model=data.get("model", config.model),
                           id=data.get("id"),
                           created=data.get("created"),
                           role="assistant",
                           content=message.get("content") or "",
                           tool_calls=calls,
                           raw=data,
                           finish_reason=choice.get("finish_reason"),
                           status="stop", **token_usage)

        except (KeyError, IndexError, TypeError, ValueError):
            raise ModelError("OpenAI 兼容接口返回了无效响应") from None
