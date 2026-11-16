"""真实 HTTP 集成测试：执行前必须单独启动 cloud 服务。

配置读取 cloud/.env.api_key，也支持同名环境变量覆盖：
MESSAGE_API_BASE_URL（默认 http://127.0.0.1:9527）、MESSAGE_API_ACCESS_TOKEN，
或 MESSAGE_API_USERNAME / MESSAGE_API_PASSWORD；聊天需要 DEEPSEEK_API_KEY。
运行：python -m pytest cloud/tests/test_message_api.py -v -s
测试会在指定服务数据库中保留唯一命名的测试会话。
"""
import time
from uuid import uuid4

import pytest

from loong_contracts.agent.models import Message
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest
from conftest import check_response


async def test_chat_complete(client, settings):
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("聊天集成测试需要配置 DEEPSEEK_API_KEY")
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id="placeholder",
        session_title="message-api-test-" + uuid4().hex,
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
        tools=[],
        messages=[Message(id=str(time.time_ns() // 1000), role="user", content="请只回复 OK")],
    )
    payload_json = body.model_dump(mode="json")
    # SecretStr 默认脱敏；HTTP 请求需要发送实际密钥。
    payload_json["llm"]["api_key"] = body.llm.api_key.get_secret_value()
    session_id = "test-" + uuid4().hex
    payload = check_response(await client.post(f"/api/messages/chat/{session_id}/complete", json=payload_json))
    messages = payload["data"]["messages"]
    assert messages[-1]["role"] == "assistant"
    assert messages[-1]["content"].strip()
    page = check_response(await client.get(f"/api/messages/sessions/{session_id}/messages"))
    assert page["total"] >= 1
    assert any(row["content"] == "请只回复 OK" for row in page["rows"])
    # 相同消息再次提交应进入重复消息分支，不再次调用模型。
    duplicate = await client.post(f"/api/messages/chat/{session_id}/complete", json=payload_json)
    assert duplicate.status_code == 200
    assert duplicate.json()["code"] != 200


async def test_chat_sse(client, settings):
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("聊天集成测试需要配置 DEEPSEEK_API_KEY")
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id="placeholder",
        session_title="message-api-test-" + uuid4().hex,
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
        tools=[],
        messages=[Message(id=str(time.time_ns() // 1000), role="user", content="请写一首五言绝句给我")],
    )
    payload_json = body.model_dump(mode="json")
    # SecretStr 默认脱敏；HTTP 请求需要发送实际密钥。
    payload_json["llm"]["api_key"] = body.llm.api_key.get_secret_value()
    session_id = "test-" + uuid4().hex
    async with client.stream("POST", f"/api/messages/chat/{session_id}/sse", json=payload_json) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

        # 聚合所有接收到的行
        lines = []
        async for line in response.aiter_lines():
            lines.append(line)

        # 拼接成完整的原始字符串（以换行符分隔）
        raw_response_str = "\n".join(lines)
        print("完整原始字符串:\n", raw_response_str)


async def test_list_sessions(client):
    payload = check_response(
        await client.get("/api/messages/sessions", params={"session_title": "", "page": 1, "page_size": 5}))
    assert isinstance(payload["rows"], list)
    assert len(payload["rows"]) <= 5
    assert payload["total"] >= 0


async def test_list_messages(client):
    payload = check_response(await client.get(f"/api/messages/sessions/nonexistent-{uuid4().hex}/messages"))
    assert payload["rows"] == []
    assert payload["total"] == 0


async def test_chat_rejects_invalid_body(client):
    response = await client.post("/api/messages/chat/test/complete", json={})
    assert response.status_code == 422
