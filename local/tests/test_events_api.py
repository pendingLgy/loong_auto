"""EventsAPI 真实集成测试：SDK → local 网关 → cloud，需先启动两项服务。"""
import asyncio
import time
from datetime import datetime
from uuid import uuid4

import httpx
import pytest

from loong_cloud_client import CloudClient
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest, MessageRequest
from loong_contracts.response.event import ChatEventResponse, ConnectionEventResponse


async def test_events_subscribe_heartbeat_and_duplicate(client):
    api = CloudClient(client).events
    client_id = "local-heartbeat-" + uuid4().hex
    async with asyncio.timeout(45):
        async with api.subscribe(client_id) as events:
            connected = await anext(events)
            assert connected.event == "connected"
            payload = connected.payload()
            assert isinstance(payload, ConnectionEventResponse)
            assert payload.client_id == client_id
            datetime.fromisoformat(payload.time)
            print(f"SSE 已连接：{client_id}")

            with pytest.raises(httpx.HTTPStatusError) as error:
                async with api.subscribe(client_id):
                    pytest.fail("重复连接不应建立成功")
            assert error.value.response.status_code == 409

            heartbeat = await anext(events)
            assert heartbeat.event == "heartbeat"
            assert heartbeat.payload().client_id == client_id
            print(f"SSE 心跳：{heartbeat.data}")


async def test_events_submit_without_subscription(client):
    api = CloudClient(client).events
    client_id = "local-unsubscribed-" + uuid4().hex
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id="local-session-" + uuid4().hex,
        session_title="local-events-no-subscription",
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", api_key="unused"),
        tools=[],
        messages=[MessageRequest(id=time.time_ns() // 1000, role="user", content="请只回复 OK")],
    )
    with pytest.raises(httpx.HTTPStatusError) as error:
        await api.submit(client_id, body)
    assert error.value.response.status_code == 409


async def test_events_submit_and_receive_dialogue(client, settings):
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("请在 local/.env.test 或环境变量配置 DEEPSEEK_API_KEY")
    api = CloudClient(client).events
    client_id = "local-dialogue-" + uuid4().hex
    session_id = "local-session-" + uuid4().hex
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id=session_id,
        session_title="local-events-dialogue-test-" + uuid4().hex,
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
        tools=[],
        messages=[MessageRequest(id=time.time_ns() // 1000, role="user", content="请只回复 OK")],
    )
    async with asyncio.timeout(180):
        async with api.subscribe(client_id) as events:
            connected = await anext(events)
            assert connected.event == "connected"
            assert connected.payload().client_id == client_id
            submitted = await api.submit(client_id, body)
            assert submitted.code == 200

            async for event in events:
                if event.event == "heartbeat":
                    assert event.payload().client_id == client_id
                    continue
                payload = event.payload()
                assert isinstance(payload, ChatEventResponse)
                assert payload.session_id == session_id
                assert not payload.error, "对话失败，请检查 local/cloud 服务端日志"
                print(f"SSE event={event.event} data={event.data}")
                if payload.summary:
                    assert not payload.remote_tool_calls
                    assert payload.messages[-1].role == "assistant"
                    assert payload.messages[-1].content.strip()
                    break
            else:
                pytest.fail("SSE 在最终回复前结束")

            # 对话结束后连接仍然存活。
            heartbeat = await anext(events)
            assert heartbeat.event == "heartbeat"
            assert heartbeat.payload().client_id == client_id
