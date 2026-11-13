"""使用真实模型执行器验证 AgentLoop，工具处理使用测试业务函数。"""

import asyncio
import json
from pathlib import Path

import pytest
from dotenv import dotenv_values

from loong_cloud.agent import AgentLoop, ModelExecutor
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


@pytest.fixture(scope="module")
def config(deepseek_api_key):
    return ModelConfig(provider="deepseek", model="deepseek-chat", temperature=0, api_key=deepseek_api_key)


class TestLoop:
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

        assert event.type == "completed"
        assert event.content.strip()
        assert event.status
        assert event.raw is not None
        message = event.messages[-1]
        assert message.role == "assistant"
        assert message.content == event.content
        assert message.input_tokens > 0
        assert message.output_tokens > 0
        assert message.total_tokens == message.raw["usage"]["total_tokens"]

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

        assert event.type == "completed"
        assert executed
        assert "LOONG_LOOP_LOCAL_OK" in event.content
        results = [message for message in event.messages if message.role == "tool"]
        assert {message.tool_call_id for message in results} == set(executed)
        assert all(message.content == "LOONG_LOOP_LOCAL_OK" for message in results)

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

                # 模拟消息传给客户端，客户端执行后将结果消息提交到下一次请求。
                client_event = json.loads(event.model_dump_json())
                results = []
                for data in client_event["tool_calls"]:
                    call = ToolCall.model_validate(data)
                    result = await execute_remote(call)
                    results.append(Message(
                        role="tool", status="tool_completed",tool_call_id=call.id,
                        content=json.dumps(result, ensure_ascii=False),
                    ))
                submitted_results = [message.model_dump(mode="json") for message in results]
                next_messages = [*event.messages, *[
                    Message.model_validate(data) for data in submitted_results
                ]]
                next_loop = AgentLoop(executor, config, tools, execute_local)
                final = await next_loop.run(next_messages)

        print("\n")
        response_dict2 = final.model_dump(mode='json', exclude_none=True)
        print(f"response2:\n{json.dumps(response_dict2, indent=4, ensure_ascii=False)}")

        assert final.type == "completed"
        assert executed == [call.id for call in event.tool_calls]
        assert [message.tool_call_id for message in results] == executed
        assert "LOONG_LOOP_REMOTE_OK" in final.content
        assert final.messages[-1].raw is not None
