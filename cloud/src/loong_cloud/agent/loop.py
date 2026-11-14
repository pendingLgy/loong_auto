"""简单模型循环：本地工具直接处理，远程工具返回客户端。"""
import time
from collections.abc import Awaitable, Callable
from contextlib import aclosing

from loong_cloud.config.config_model import ModelConfig
from loong_contracts.utis import uuid_util
from .executor import ModelExecutor
from .message_handler import build_tool_call_message
from .models import Message, ModelRequest, ToolCall, ToolDefinition, LoopEvent


class AgentLoop:
    """每次请求新建实例；消息历史由调用方保存并在下次调用时传入。"""

    def __init__(
            self,
            executor: ModelExecutor,
            config: ModelConfig,
            tools: list[ToolDefinition],
            local_executor: Callable[[ToolCall], Awaitable[str]],
    ):
        self.executor = executor
        self.config = config
        self.tools = tools
        self.local_executor = local_executor

    async def run_stream(self, messages: list[Message]):
        """返回模型增量事件，最后返回 tool_calls 或 completed 的 LoopEvent。"""
        messages = list(messages)

        max_loop = 5
        loop = 0
        while True and (loop < max_loop):
            loop += 1

            response = None
            async with aclosing(self.executor.stream(
                    self.config, ModelRequest(messages=messages, tools=self.tools),
            )) as events:
                async for event in events:
                    if isinstance(event, Message) and event.status in ["stop","tool_calling"]:
                        response = event
                    else:
                        loop_event = LoopEvent(messages=[event], tool_calls=[], remote_tool_calls=[])
                        yield loop_event

            if response is None:
                raise RuntimeError("模型流未返回完整响应")
            message = response
            messages.append(message)

            if not message.tool_calls:
                yield LoopEvent(summary=True,messages=messages, tool_calls=[])
                return

            tool_call_messages: list[Message] = []
            remote_calls: list[ToolCall] = []
            tool_calls: list[ToolCall] = message.tool_calls

            for call in message.tool_calls:
                if call.location == "local":
                    tool_response = await self.local_executor(call)
                    tool_call_messages.append(Message(id=uuid_util.uuid_str(),
                                                      created=int(time.time()),
                                                      role="tool",
                                                      status="tool_called",
                                                      tool_call_id=call.id,
                                                      content=tool_response))
                else:
                    remote_calls.append(call)

            if remote_calls:
                yield LoopEvent(messages=messages, tool_call_messages=tool_call_messages,
                                 tool_calls=tool_calls, remote_tool_calls=remote_calls)
                return
            else:
                messages = build_tool_call_message(messages, tool_call_messages, tool_calls)



    async def run_sse(self, messages: list[Message]):
        """供 StreamingResponse 使用；调用结束或取消时关闭上游生成器。"""
        async with aclosing(self.run_stream(messages)) as events:
            async for event in events:
                yield event.to_sse()

    async def run(self, messages: list[Message]) -> LoopEvent:
        messages = list(messages)

        max_loop = 5
        loop = 0
        while True and (loop < max_loop):
            loop += 1

            message = await self.executor.complete(
                self.config, ModelRequest(messages=messages, tools=self.tools),
            )
            messages.append(message)
            if not message.tool_calls:
                return LoopEvent(summary=True,messages=messages, tool_calls=[])

            tool_call_messages: list[Message] = []
            remote_calls: list[ToolCall] = []
            tool_calls: list[ToolCall] = message.tool_calls

            for call in message.tool_calls:
                if call.location == "local":
                    tool_response = await self.local_executor(call)
                    tool_call_messages.append(Message(id=uuid_util.uuid_str(),
                                                      created=int(time.time()),
                                                      role="tool",
                                                      status="tool_called",
                                                      tool_call_id=call.id,
                                                      content=tool_response))
                else:
                    remote_calls.append(call)

            if remote_calls:
                return LoopEvent(messages=messages, tool_call_messages=tool_call_messages,
                                 tool_calls=tool_calls, remote_tool_calls=remote_calls)
            else:
                messages = build_tool_call_message(messages, tool_call_messages, tool_calls)

        Message(id=uuid_util.uuid_str(),role="assistant",status="stop",created=int(time.time()), content="请求执行异常")
        return LoopEvent(messages=messages, tool_calls=[])
