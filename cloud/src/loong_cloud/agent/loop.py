"""简单模型循环：本地工具直接处理，远程工具返回客户端。"""
import time
from collections.abc import Awaitable, Callable
from contextlib import aclosing

from loong_contracts.agent.models import LoopEvent, Message, ModelRequest, ToolCall, ToolDefinition
from loong_contracts.common.llm_message_constant import GlobalMessageRole, GlobalMessageStatus
from loong_contracts.utils import uuid_util

from loong_cloud.agent.executor import ModelExecutor
from loong_cloud.agent.message_handler import build_tool_call_message
from loong_cloud.config.config_model import ModelConfig


class AgentLoop:
    """每次请求新建实例；消息历史由调用方保存并在下次调用时传入。"""

    def __init__(
        self,
        executor: ModelExecutor,
        config: ModelConfig,
        tools: list[ToolDefinition],
        local_executor: dict[str, Callable[[ToolCall], Awaitable[str]]],
        client_id: str,
        session_id: str,
    ):
        self.executor = executor
        self.client_id = client_id
        self.session_id = session_id
        self.config = config
        self.tools = tools
        self.local_executors = local_executor

    async def _execute_local(self, call: ToolCall) -> str:
        """从本地执行器集合中选择支持该工具的执行器。"""
        executor = self.local_executors.get(call.name)
        if executor is None:
            raise ValueError(f"未找到本地工具执行器: {call.name}")
        return await executor(call)

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
                    if isinstance(event, Message) and event.status in ["stop", "tool_calling"]:
                        response = event
                    else:
                        last_message_event = event.status
                        loop_event = LoopEvent(client_id=self.client_id, session_id=self.session_id,
                                               messages=[event], tool_calls=None,
                                               remote_tool_calls=None,
                                               last_message_event=last_message_event)
                        yield loop_event

            if response is None:
                raise RuntimeError("模型流未返回完整响应")
            message = response
            messages.append(message)

            last_message_event = messages[-1].status

            if not message.tool_calls:
                yield LoopEvent(client_id=self.client_id, session_id=self.session_id, summary=True,
                                messages=messages, tool_calls=None,
                                last_message_event=last_message_event)
                return

            tool_call_messages: list[Message] = []
            remote_calls: list[ToolCall] = []
            tool_calls: list[ToolCall] = message.tool_calls

            for call in message.tool_calls:
                if call.location == "local":
                    tool_response = await self._execute_local(call)
                    tool_call_messages.append(Message(id=uuid_util.uuid_str(),
                                                      created=int(time.time()),
                                                      role=GlobalMessageRole.TOOL,
                                                      status=GlobalMessageStatus.TOOL_CALLED,
                                                      tool_call_id=call.id,
                                                      content=tool_response))
                else:
                    remote_calls.append(call)

            if remote_calls:
                yield LoopEvent(client_id=self.client_id, session_id=self.session_id,
                                messages=messages, tool_call_messages=tool_call_messages,
                                tool_calls=tool_calls, remote_tool_calls=remote_calls,
                                last_message_event=last_message_event)
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

            last_message_event = messages[-1].status

            if not message.tool_calls:
                return LoopEvent(client_id=self.client_id, session_id=self.session_id, summary=True,
                                 messages=messages, tool_calls=None,
                                 last_message_event=last_message_event)

            tool_call_messages: list[Message] = []
            remote_calls: list[ToolCall] = []
            tool_calls: list[ToolCall] = message.tool_calls

            for call in message.tool_calls:
                if call.location == "local":
                    tool_response = await self._execute_local(call)
                    tool_call_messages.append(Message(id=uuid_util.uuid_str(),
                                                      created=int(time.time()),
                                                      role=GlobalMessageRole.TOOL,
                                                      status=GlobalMessageStatus.TOOL_CALLED,
                                                      tool_call_id=call.id,
                                                      content=tool_response))
                else:
                    remote_calls.append(call)

            if remote_calls:
                return LoopEvent(client_id=self.client_id, session_id=self.session_id,
                                 messages=messages, tool_call_messages=tool_call_messages,
                                 tool_calls=tool_calls, remote_tool_calls=remote_calls,
                                 last_message_event=last_message_event)
            else:
                messages = build_tool_call_message(messages, tool_call_messages, tool_calls)

        error_msg = Message(id=uuid_util.uuid_str(), role=GlobalMessageRole.ASSISTANT,
                            status=GlobalMessageStatus.STOP, created=int(time.time()),
                            content="请求执行异常")
        messages.append(error_msg)

        return LoopEvent(client_id=self.client_id, session_id=self.session_id, error=True,
                         summary=False, messages=messages, tool_calls=None,
                         last_message_event=error_msg.status)
