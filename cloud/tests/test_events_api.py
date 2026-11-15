"""SSE 测试：HTTP 集成用例需要先启动单 worker cloud 服务。
异常断连用例使用真实 TCP 连接，退避及清理行为由人工查看服务端日志。

复用 test_message_api 的配置与登录 fixture，读取 cloud/.env.api_key。
对话测试使用真实 DeepSeek，产生模型费用并保留测试会话记录。
运行：python -m pytest cloud/tests/test_events_api.py -v -s
"""

import asyncio
import json
import time
from contextlib import suppress
from datetime import datetime
from uuid import uuid4
from urllib.parse import urlsplit

import pytest

from loong_contracts.request.message import AddMessageRequest, LLMParamRequest, MessageRequest
from test_message_api import client, settings  # noqa: F401：导入共享的 pytest fixture


async def read_event(lines):
    """消费一个完整 SSE 帧；复用同一个行迭代器，避免丢失缓冲数据。"""
    event = "message"
    data = []
    async for line in lines:
        if not line:
            if data:
                payload = json.loads("\n".join(data))
                print(f"SSE event={event} data={json.dumps(payload, ensure_ascii=False)}")
                return event, payload
            event = "message"
        elif line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:"):
            data.append(line[5:].lstrip())
    pytest.fail("SSE 连接在完整事件到达前关闭")


async def test_sse_heartbeat_and_duplicate_connection(client):
    session_id = "events-heartbeat-" + uuid4().hex
    path = f"/api/events/chat/{session_id}/sse"
    async with asyncio.timeout(45):
        async with client.stream("GET", path) as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")
            assert response.headers["cache-control"] == "no-cache"
            lines = response.aiter_lines()
            event, payload = await read_event(lines)
            assert event == "connected"
            assert payload["session_id"] == session_id
            datetime.fromisoformat(payload["time"])

            duplicate = await client.get(path)
            assert duplicate.status_code == 409

            event, payload = await read_event(lines)
            assert event == "heartbeat"
            assert payload["session_id"] == session_id
            datetime.fromisoformat(payload["time"])



async def test_submit_requires_sse_connection(client):
    session_id = "events-disconnected-" + uuid4().hex
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id=session_id,
        session_title="events-api-disconnected-test",
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0,
                            api_key="not-used-without-connection"),
        tools=[],
        messages=[MessageRequest(id=time.time_ns() // 1000, role="user", content="请只回复 OK")],
    )
    payload = body.model_dump(mode="json")
    payload["llm"]["api_key"] = body.llm.api_key.get_secret_value()
    response = await client.post(f"/api/events/chat/{session_id}/messages", json=payload)
    assert response.status_code == 409
    assert response.json()["code"] == 409


async def test_submit_message_pushes_dialogue_to_sse(client, settings):
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("真实对话测试需要配置 DEEPSEEK_API_KEY")
    session_id = "events-dialogue-" + uuid4().hex
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id=session_id,
        session_title="events-api-test-" + uuid4().hex,
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
        tools=[],
        messages=[MessageRequest(id=time.time_ns() // 1000, role="user", content="请只回复 OK")],
    )
    payload = body.model_dump(mode="json")
    payload["llm"]["api_key"] = body.llm.api_key.get_secret_value()

    client_id = "client-" + uuid4().hex
    async with asyncio.timeout(180):
        async with client.stream("GET", f"/api/events/chat/{client_id}/sse") as response:
            assert response.status_code == 200
            lines = response.aiter_lines()
            event, connected = await read_event(lines)
            assert event == "connected"
            assert connected["client_id"] == client_id

            submitted = await client.post(f"/api/events/chat/{client_id}/messages", json=payload)
            assert submitted.status_code == 200
            assert submitted.json()["code"] == 200

            while True:
                event, result = await read_event(lines)

                # print(f"event: {event} result: {result}")

                assert result["session_id"] == session_id
                if event == "heartbeat":
                    continue
                assert not result["error"], "对话执行失败，请检查服务端日志"
                if result["summary"]:
                    final_message = result["messages"][-1]
                    assert final_message["role"] == "assistant"
                    assert final_message["content"].strip()
                    break

            # 完整对话结束后，订阅仍保持连接并继续发送心跳。
            event, heartbeat = await read_event(lines)
            assert event == "heartbeat"
            assert heartbeat["client_id"] == client_id
