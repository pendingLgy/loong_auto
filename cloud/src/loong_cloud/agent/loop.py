"""简单模型循环：本地工具直接处理，远程工具返回客户端。"""

from collections.abc import Awaitable, Callable
from typing import Any, Literal

from pydantic import BaseModel, Field

from loong_cloud.config.config_model import ModelConfig
from .executor import ModelExecutor
from .models import Message, ModelRequest, ToolCall, ToolDefinition


class LoopEvent(BaseModel):
    type: Literal["tool_calls", "completed"]
    status: str | None = Field(default=None, description="LLM 返回的结束原因 finish_reason")
    raw: dict[str, Any] | None = Field(default=None, description="本轮最后一次 LLM 调用的原始响应")
    content: str = Field(default="")
    tool_calls: list[ToolCall] = Field(default_factory=list)
    messages: list[Message] = Field(default_factory=list)


class AgentLoop:
    """每次请求新建实例；消息历史由调用方保存并在下次调用时传入。"""

    def __init__(
        self, executor: ModelExecutor, config: ModelConfig,
        tools: list[ToolDefinition],
        local_executor: Callable[[ToolCall], Awaitable[str]],
    ):
        self.executor = executor
        self.config = config
        self.tools = tools
        self.local_executor = local_executor

    async def run(self, messages: list[Message]) -> LoopEvent:
        messages = list(messages)
        while True:
            response = await self.executor.complete(
                self.config, ModelRequest(messages=messages, tools=self.tools),
            )
            message = response.message
            messages.append(message)
            if not message.tool_calls:
                return LoopEvent(
                    type="completed", status=message.status, raw=message.raw,
                    content=message.content, messages=messages,
                )

            remote_calls = []
            for call in message.tool_calls:
                if call.location == "local":
                    result = await self.local_executor(call)
                    messages.append(Message(role="tool", status="tool_completed", tool_call_id=call.id, content=result))
                else:
                    remote_calls.append(call)

            if remote_calls:
                return LoopEvent(
                    type="tool_calls", status=message.status, raw=message.raw, content=message.content,
                    tool_calls=remote_calls, messages=messages,
                )
