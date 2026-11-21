"""使用真实模型执行器验证 AgentLoop，工具处理使用测试业务函数。"""

import asyncio
import json
import time
from pathlib import Path
from uuid import uuid4

import pytest
from dotenv import dotenv_values
from loong_contracts.agent.models import Message, ToolDefinition
from loong_contracts.common.llm_message_constant import GlobalMessageRole, GlobalMessageStatus
from loong_contracts.utils import uuid_util

from loong_cloud.agent import AgentLoop, LoopEvent, ModelExecutor
from loong_cloud.agent.message_handler import build_tool_call_message
from loong_cloud.agent.supply.supplier import load_supplier
from loong_cloud.config.config_model import ModelConfig


@pytest.fixture(scope="module")
def deepseek_api_key():
    path = Path(__file__).resolve().parents[1] / ".env.api_key"
    values = dotenv_values(path, interpolate=False) if path.is_file() else {}
    key = (values.get("DEEPSEEK_API_KEY") or "").strip()
    if not key:
        pytest.skip("请在 cloud/.env.api_key 中配置 DEEPSEEK_API_KEY")
    return key


@pytest.fixture
def config(deepseek_api_key):
    return ModelConfig(provider="deepseek", model="deepseek-chat", temperature=0,
                       api_key=deepseek_api_key)


@pytest.fixture(scope='module')
def supplier_model(settings):
    supplier_path = settings("SUPPLIER_CONFIG_PATH")
    return load_supplier(supplier_path)

class TestLoopSSE:

    async def test_live_sse_completed_message(self, config, supplier_model):
        async def execute_local(call):
            pytest.fail("没有注册工具，不应执行工具")

        client_id = "client-" + uuid4().hex
        session_id = "session-" + uuid4().hex
        async with ModelExecutor(supplier=supplier_model) as executor:
            async with asyncio.timeout(120):
                events = []
                async for frame in AgentLoop(executor, config, [],
                                             {"read_test_file": execute_local}, client_id=client_id,
                                             session_id=session_id).run_sse([
                    Message(role=GlobalMessageRole.USER, content="请回复一句简短的问候语"),
                ]):
                    event_line, data_line, ending = frame.split("\n", 2)
                    data = json.loads(data_line.removeprefix("data: "))
                    print(f"\nSSE event:\n{json.dumps(data, ensure_ascii=False)}",
                          flush=True)
                    events.append(data)

    async def test_live_sse_remote_tool_next_request(self, config, supplier_model):
        async def execute_local(call):
            pytest.fail("远程工具不应进入本地执行函数")

        async def execute_remote(call):
            assert call.name == "get_client_info"
            assert call.location == "remote"
            await asyncio.sleep(0)
            return json.dumps({"marker": "LOONG_SSE_REMOTE_OK"})

        client_id = "client-" + uuid4().hex
        session_id = "session-" + uuid4().hex

        tools = [
            ToolDefinition(name="get_client_info", location="remote", description="获取客户端信息")]
        async with ModelExecutor(supplier=supplier_model) as executor:
            async with asyncio.timeout(180):
                frames = []
                async for frame in AgentLoop(executor, config, tools,
                                             {"read_test_file": execute_local}, client_id=client_id,
                                             session_id=session_id).run_sse([
                    Message(role=GlobalMessageRole.USER,
                            content="必须调用 get_client_info，收到结果后回复其中的标记，不要重复调用。"),
                ]):
                    data = json.loads(frame.split("\n")[1].removeprefix("data: "))
                    print(f"\nSSE request 1:\n{json.dumps(data, ensure_ascii=False)}",
                          flush=True)
                    frames.append(data)

                event: LoopEvent = LoopEvent.model_validate(frames[-1])
                tool_call_messages = event.tool_call_messages

                for call in event.remote_tool_calls:
                    result = await execute_remote(call)
                    tool_call_messages.append(Message(
                        role=GlobalMessageRole.TOOL, status=GlobalMessageStatus.TOOL_CALLED, tool_call_id=call.id,
                        content=json.dumps(result, ensure_ascii=False),
                    ))

                next_messages = build_tool_call_message(event.messages, event.tool_call_messages,
                                                        event.tool_calls)

                # 新请求重新创建 Loop，并以 SSE 接收工具结果后的模型回复。
                final_frames = []
                async for frame in AgentLoop(executor, config, tools,
                                             {"read_test_file": execute_local}, client_id=client_id,
                                             session_id=session_id).run_sse(next_messages):
                    data = json.loads(frame.split("\n")[1].removeprefix("data: "))
                    print(f"\nSSE request 2:\n{json.dumps(data, ensure_ascii=False)}",
                          flush=True)
                    final_frames.append(data)

    async def test_live_sse_remote_local_tool_next_request(self, config, tmp_path, supplier_model):
        path = tmp_path / "example2.txt"
        path.write_text("LOONG_LOOP_LOCAL_OK", encoding="utf-8")

        async def execute_local(call):
            assert call.name == "read_test_file"
            assert call.location == "local"
            executed.append(call.id)
            return path.read_text(encoding="utf-8")

        executed = []

        async def execute_remote(call):
            """模拟客户端接收工具调用并异步执行。"""
            assert call.location == "remote"
            assert call.name == "get_client_info"
            await asyncio.sleep(0)
            executed.append(call.id)
            return {"marker": "LOONG_LOOP_REMOTE_OK", "client": "test-client"}

        tools = [
            ToolDefinition(name="read_test_file", location="local", description="读取测试文件"),
            ToolDefinition(name="get_client_info", location="remote",
                           description="获取客户端提供的信息")
        ]

        messages = [Message(role=GlobalMessageRole.USER,
                            content="请同时调用 read_test_file获取客户端信息，read_test_file读取测试文件。两项都必须调用，收到两项结果后简短总结，不要重复调用已完成的工具。")]

        client_id = "client-" + uuid4().hex
        session_id = "session-" + uuid4().hex

        async with ModelExecutor(supplier=supplier_model) as executor:
            async with asyncio.timeout(180):
                frames = []
                async for frame in AgentLoop(executor, config, tools,
                                             {"read_test_file": execute_local}, client_id,
                                             session_id).run_sse(messages):
                    data = json.loads(frame.split("\n")[1].removeprefix("data: "))
                    print(f"\nSSE request 1:\n{json.dumps(data, ensure_ascii=False)}",
                          flush=True)
                    frames.append(data)

                event: LoopEvent = LoopEvent.model_validate(frames[-1])
                tool_call_messages = event.tool_call_messages

                for call in event.remote_tool_calls:
                    result = await execute_remote(call)
                    tool_call_messages.append(Message(
                        role=GlobalMessageRole.TOOL, status=GlobalMessageStatus.TOOL_CALLED, tool_call_id=call.id,
                        content=json.dumps(result, ensure_ascii=False),
                    ))

                next_messages = build_tool_call_message(event.messages, event.tool_call_messages,
                                                        event.tool_calls)

                # 新请求重新创建 Loop，并以 SSE 接收工具结果后的模型回复。
                final_frames = []
                async for frame in AgentLoop(executor, config, tools,
                                             {"read_test_file": execute_local}, client_id,
                                             session_id).run_sse(next_messages):
                    data = json.loads(frame.split("\n")[1].removeprefix("data: "))
                    print(f"\nSSE request 2:\n{json.dumps(data, ensure_ascii=False)}",
                          flush=True)
                    final_frames.append(data)


class TestLoopRun:
    async def test_live_completed_message(self, config, supplier_model):
        async def execute_local(call):
            pytest.fail("没有注册工具，不应执行工具")

        client_id = "client-" + uuid4().hex
        session_id = "session-" + uuid4().hex

        async with ModelExecutor(supplier=supplier_model) as executor:
            async with asyncio.timeout(120):
                event = await AgentLoop(executor, config, [], {"read_test_file": execute_local},
                                        client_id, session_id).run([
                    Message(role=GlobalMessageRole.USER, content="请只回复 OK"),
                ])

        print("\n")
        response_dict = event.model_dump(mode='json', exclude_none=True)
        print(f"response:\n{json.dumps(response_dict, ensure_ascii=False)}")

    async def test_live_local_tool(self, config, tmp_path, supplier_model):
        path = tmp_path / "example.txt"
        path.write_text("LOONG_LOOP_LOCAL_OK", encoding="utf-8")
        executed = []

        async def execute_local(call):
            assert call.name == "read_test_file"
            assert call.location == "local"
            executed.append(call.id)
            return path.read_text(encoding="utf-8")

        client_id = "client-" + uuid4().hex
        session_id = "session-" + uuid4().hex

        tools = [
            ToolDefinition(name="read_test_file", location="local", description="读取测试文件")]
        async with ModelExecutor(supplier=supplier_model) as executor:
            async with asyncio.timeout(120):
                event = await AgentLoop(executor, config, tools, {"read_test_file": execute_local},
                                        client_id, session_id).run([
                    Message(role=GlobalMessageRole.USER,
                            content="必须调用 read_test_file，然后返回读到的内容；不要重复调用。"),
                ])

        print("\n")
        response_dict = event.model_dump(mode='json', exclude_none=True)
        print(f"response:\n{json.dumps(response_dict, ensure_ascii=False)}")

    async def test_live_remote_tool_next_request(self, config, supplier_model):
        async def execute_local(call):
            pytest.fail("远程工具不应进入本地执行函数")

        executed = []

        async def execute_remote(call):
            """模拟客户端接收工具调用并异步执行。"""
            assert call.location == "remote"
            assert call.name == "get_client_info"
            await asyncio.sleep(0)
            executed.append(call.id)
            return {"marker": "LOONG_LOOP_REMOTE_OK", "client": "test-client"}

        tools = [ToolDefinition(name="get_client_info", location="remote",
                                description="获取客户端提供的信息")]
        messages = [Message(role=GlobalMessageRole.USER,
                            content="必须调用 get_client_info，拿到结果后返回其中的标记，不要重复调用。")]

        client_id = "client-" + uuid4().hex
        session_id = "session-" + uuid4().hex

        async with ModelExecutor(supplier=supplier_model) as executor:
            async with asyncio.timeout(180):
                event = await AgentLoop(executor, config, tools, {"read_test_file": execute_local},
                                        client_id, session_id).run(messages)

                print("\n")
                response_dict_1 = event.model_dump(mode='json', exclude_none=True)
                print(f"response1:\n{json.dumps(response_dict_1, ensure_ascii=False)}")

                tool_call_messages = event.tool_call_messages

                for call in event.remote_tool_calls:
                    result = await execute_remote(call)
                    tool_call_messages.append(Message(
                        role=GlobalMessageRole.TOOL, status=GlobalMessageStatus.TOOL_CALLED, tool_call_id=call.id,
                        content=json.dumps(result, ensure_ascii=False),
                    ))

                next_messages = build_tool_call_message(event.messages, event.tool_call_messages,
                                                        event.tool_calls)
                next_loop = AgentLoop(executor, config, tools, {"read_test_file": execute_local},
                                      client_id, session_id)
                final = await next_loop.run(next_messages)

        print("\n")
        response_dict2 = final.model_dump(mode='json', exclude_none=True)
        print(f"response2:\n{json.dumps(response_dict2, ensure_ascii=False)}")

    async def test_multiple_live_remote_tool_next_request(self, config, tmp_path, supplier_model):
        path = tmp_path / "example.txt"
        path.write_text("LOONG_LOOP_LOCAL_OK", encoding="utf-8")

        async def execute_local(call):
            assert call.name == "read_test_file"
            assert call.location == "local"
            executed.append(call.id)
            return path.read_text(encoding="utf-8")

        executed = []

        async def execute_remote(call):
            """模拟客户端接收工具调用并异步执行。"""
            assert call.location == "remote"
            assert call.name == "get_client_info"
            await asyncio.sleep(0)
            executed.append(call.id)
            return {"marker": "LOONG_LOOP_REMOTE_OK", "client": "test-client"}

        tools = [
            ToolDefinition(name="read_test_file", location="local", description="读取测试文件"),
            ToolDefinition(name="get_client_info", location="remote",
                           description="获取客户端提供的信息")
        ]

        messages = [Message(role=GlobalMessageRole.USER,
                            content="请同时调用 read_test_file获取客户端信息，read_test_file读取测试文件。两项都必须调用，收到两项结果后简短总结，不要重复调用已完成的工具。")]

        client_id = "client-" + uuid4().hex
        session_id = "session-" + uuid4().hex

        async with ModelExecutor(supplier=supplier_model) as executor:
            async with asyncio.timeout(180):
                event = await AgentLoop(executor, config, tools, {"read_test_file": execute_local},
                                        client_id, session_id).run(messages)

                print("\n")
                response_dict_1 = event.model_dump(mode='json', exclude_none=True)
                print(f"response1:\n{json.dumps(response_dict_1, ensure_ascii=False)}")

                # 模拟消息传给客户端，客户端执行后将结果消息提交到下一次请求。
                tool_call_messages = event.tool_call_messages

                for call in event.remote_tool_calls:
                    result = await execute_remote(call)
                    tool_call_messages.append(Message(id=uuid_util.uuid_str(),
                                                      created=int(time.time()),
                                                      role=GlobalMessageRole.TOOL, status=GlobalMessageStatus.TOOL_CALLED,
                                                      tool_call_id=call.id,
                                                      content=json.dumps(result,
                                                                         ensure_ascii=False),
                                                      ))

                next_messages = build_tool_call_message(event.messages, event.tool_call_messages,
                                                        event.tool_calls)

                next_loop = AgentLoop(executor, config, tools, {"read_test_file": execute_local},
                                      client_id, session_id)
                final = await next_loop.run(next_messages)

        print("\n")
        response_dict2 = final.model_dump(mode='json', exclude_none=True)
        print(f"response2:\n{json.dumps(response_dict2, ensure_ascii=False)}")
