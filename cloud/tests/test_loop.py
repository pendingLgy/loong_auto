"""使用真实模型执行器验证 AgentLoop，工具处理使用测试业务函数。"""

import asyncio
import json
from os import path
from pathlib import Path

import pytest
from dotenv import dotenv_values

from loong_cloud.agent import AgentLoop, ModelExecutor
from loong_cloud.agent.message_handler import build_tool_call_message
from loong_cloud.agent.models import Message, ToolCall, ToolDefinition
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
    return ModelConfig(provider="deepseek", model="deepseek-chat", temperature=0, api_key=deepseek_api_key)


class TestLoop:


    async def test_live_sse_completed_message(self, config):
        async def execute_local(call):
            pytest.fail("没有注册工具，不应执行工具")

        async with ModelExecutor() as executor:
            async with asyncio.timeout(120):
                events = []
                async for frame in AgentLoop(executor, config, [], execute_local).run_sse([
                    Message(role="user", content="请回复一句简短的问候语"),
                ]):
                    event_line, data_line, ending = frame.split("\n", 2)
                    data = json.loads(data_line.removeprefix("data: "))
                    print(f"\nSSE event:\n{json.dumps(data, indent=4, ensure_ascii=False)}", flush=True)
                    events.append(data)


    async def test_live_sse_remote_tool_next_request(self, config):
        async def execute_local(call):
            pytest.fail("远程工具不应进入本地执行函数")

        async def execute_remote(call):
            assert call.name == "get_client_info"
            assert call.location == "remote"
            await asyncio.sleep(0)
            return json.dumps({"marker": "LOONG_SSE_REMOTE_OK"})

        tools = [ToolDefinition(name="get_client_info", location="remote", description="获取客户端信息")]
        async with ModelExecutor() as executor:
            async with asyncio.timeout(180):
                frames = []
                async for frame in AgentLoop(executor, config, tools, execute_local).run_sse([
                    Message(role="user", content="必须调用 get_client_info，收到结果后回复其中的标记，不要重复调用。"),
                ]):
                    data = json.loads(frame.split("\n")[1].removeprefix("data: "))
                    print(f"\nSSE request 1:\n{json.dumps(data, indent=4, ensure_ascii=False)}", flush=True)
                    frames.append(data)
                event = frames[-1]
                assert event["type"] == "tool_calls"
                assert event["status"] == "tool_calls"
                assert event["tool_calls"]
                messages = [Message.model_validate(data) for data in event["messages"]]
                for data in event["tool_calls"]:
                    call = ToolCall.model_validate(data)
                    messages.append(Message(role="tool", tool_call_id=call.id, content=await execute_remote(call)))

                # 新请求重新创建 Loop，并以 SSE 接收工具结果后的模型回复。
                final_frames = []
                async for frame in AgentLoop(executor, config, tools, execute_local).run_sse(messages):
                    data = json.loads(frame.split("\n")[1].removeprefix("data: "))
                    print(f"\nSSE request 2:\n{json.dumps(data, indent=4, ensure_ascii=False)}", flush=True)
                    final_frames.append(data)

        final = final_frames[-1]
        assert final["type"] == "completed"
        assert "LOONG_SSE_REMOTE_OK" in final["content"]
        assert "".join(event["text"] for event in final_frames if event["type"] == "text_delta") == final["content"]

    async def test_live_completed_message(self, config):
        async def execute_local(call):
            pytest.fail("没有注册工具，不应执行工具")

        async with ModelExecutor() as executor:
            async with asyncio.timeout(120):
                event = await AgentLoop(executor, config, [], execute_local).run([
                    Message(role="user", content="请只回复 OK"),
                ])

        print("\n")
        response_dict = event.model_dump(mode='json', exclude_none=True)
        print(f"response:\n{json.dumps(response_dict, indent=4, ensure_ascii=False)}")


    async def test_live_local_tool(self, config, tmp_path):
        path = tmp_path / "example.txt"
        path.write_text("LOONG_LOOP_LOCAL_OK", encoding="utf-8")
        executed = []

        async def execute_local(call):
            assert call.name == "read_test_file"
            assert call.location == "local"
            executed.append(call.id)
            return path.read_text(encoding="utf-8")

        tools = [ToolDefinition(name="read_test_file", location="local", description="读取测试文件")]
        async with ModelExecutor() as executor:
            async with asyncio.timeout(120):
                event = await AgentLoop(executor, config, tools, execute_local).run([
                    Message(role="user", content="必须调用 read_test_file，然后返回读到的内容；不要重复调用。"),
                ])


        print("\n")
        response_dict = event.model_dump(mode='json', exclude_none=True)
        print(f"response:\n{json.dumps(response_dict, indent=4, ensure_ascii=False)}")


    async def test_live_remote_tool_next_request(self, config):
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

        tools = [ToolDefinition(name="get_client_info", location="remote", description="获取客户端提供的信息")]
        messages = [Message(role="user", content="必须调用 get_client_info，拿到结果后返回其中的标记，不要重复调用。")]
        async with ModelExecutor() as executor:
            async with asyncio.timeout(180):
                event = await AgentLoop(executor, config, tools, execute_local).run(messages)

                print("\n")
                response_dict_1 = event.model_dump(mode='json', exclude_none=True)
                print(f"response1:\n{json.dumps(response_dict_1, indent=4, ensure_ascii=False)}")

                tool_call_messages = event.tool_call_messages

                for call in event.remote_tool_calls:
                    result = await execute_remote(call)
                    tool_call_messages.append(Message(
                        role="tool", status="tool_called",tool_call_id=call.id,
                        content=json.dumps(result, ensure_ascii=False),
                    ))

                next_messages = build_tool_call_message(event.messages, event.tool_call_messages, event.tool_calls)
                next_loop = AgentLoop(executor, config, tools, execute_local)
                final = await next_loop.run(next_messages)

        print("\n")
        response_dict2 = final.model_dump(mode='json', exclude_none=True)
        print(f"response2:\n{json.dumps(response_dict2, indent=4, ensure_ascii=False)}")



    async def test_multiple_live_remote_tool_next_request(self, config, tmp_path):
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
            ToolDefinition(name="get_client_info", location="remote", description="获取客户端提供的信息")
        ]

        messages = [Message(role="user", content="请同时调用 read_test_file获取客户端信息，read_test_file读取测试文件。两项都必须调用，收到两项结果后简短总结，不要重复调用已完成的工具。")]
        async with ModelExecutor() as executor:
            async with asyncio.timeout(180):
                event = await AgentLoop(executor, config, tools, execute_local).run(messages)

                print("\n")
                response_dict_1 = event.model_dump(mode='json', exclude_none=True)
                print(f"response1:\n{json.dumps(response_dict_1, indent=4, ensure_ascii=False)}")

                # 模拟消息传给客户端，客户端执行后将结果消息提交到下一次请求。
                tool_call_messages = event.tool_call_messages

                for call in event.remote_tool_calls:
                    result = await execute_remote(call)
                    tool_call_messages.append(Message(
                        role="tool", status="tool_called", tool_call_id=call.id,
                        content=json.dumps(result, ensure_ascii=False),
                    ))

                next_messages = build_tool_call_message(event.messages, event.tool_call_messages, event.tool_calls)

                next_loop = AgentLoop(executor, config, tools, execute_local)
                final = await next_loop.run(next_messages)

        print("\n")
        response_dict2 = final.model_dump(mode='json', exclude_none=True)
        print(f"response2:\n{json.dumps(response_dict2, indent=4, ensure_ascii=False)}")


