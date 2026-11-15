"""真实 HTTP 集成测试：执行前必须单独启动 cloud 服务。

配置读取 cloud/.env.api_key，也支持同名环境变量覆盖：
MESSAGE_API_BASE_URL（默认 http://127.0.0.1:9527）、MESSAGE_API_ACCESS_TOKEN，
或 MESSAGE_API_USERNAME / MESSAGE_API_PASSWORD；聊天需要 DEEPSEEK_API_KEY。
运行：python -m pytest cloud/tests/test_message_api.py -v -s
测试会在指定服务数据库中保留唯一命名的测试会话。
"""
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Callable
from uuid import uuid4

import httpx
import pytest
from dotenv import dotenv_values, set_key
from httpx import AsyncClient, Response

from loong_contracts.request.login import LoginRequest
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest, MessageRequest

CONFIG_PATH = Path(__file__).resolve().parents[1] / ".env.api_key"


async def init_login(http: AsyncClient, settings: Callable[..., str], token) -> Any:
    username, password = settings("MESSAGE_API_USERNAME"), settings("MESSAGE_API_PASSWORD")
    if not username or not password:
        pytest.fail(
            "请配置 MESSAGE_API_ACCESS_TOKEN 或 MESSAGE_API_USERNAME / MESSAGE_API_PASSWORD，并启动 cloud 服务")
    try:
        response = await http.post("/api/auth/login",
                                   json=LoginRequest(username=username, password=password,
                                                     platform="web").model_dump(mode="json"))
    except httpx.ConnectError:
        pytest.fail("无法连接 cloud 服务，请先启动服务并检查 MESSAGE_API_BASE_URL")
    response.raise_for_status()
    payload = response.json()
    assert payload["code"] == 200, "测试账号登录失败"
    token = payload["data"]["access_token"]
    set_key(str(CONFIG_PATH), "MESSAGE_API_ACCESS_TOKEN", token)
    # 更新时间写在 token 上方；替换旧注释，保留文件中其他配置。
    lines = CONFIG_PATH.read_text(encoding="utf-8").splitlines()
    lines = [line for line in lines if not line.startswith("# MESSAGE_API_ACCESS_TOKEN 更新时间：")]
    index = next(i for i, line in enumerate(lines) if line.startswith("MESSAGE_API_ACCESS_TOKEN="))
    lines.insert(index, "# MESSAGE_API_ACCESS_TOKEN 更新时间：" + datetime.now().astimezone().isoformat(
        timespec="seconds"))
    CONFIG_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return token

@pytest.fixture(scope="module")
def settings():
    values = dotenv_values(CONFIG_PATH, interpolate=False)

    def read(name, default=""):
        return os.environ.get(name, values.get(name) or default)

    return read


@pytest.fixture
async def client(settings):
    async with httpx.AsyncClient(base_url=settings("MESSAGE_API_BASE_URL", "http://127.0.0.1:9527"),
                                 timeout=180) as http:
        # 每次重新读取文件，复用前一个测试登录后保存的令牌。
        token = (dotenv_values(CONFIG_PATH, interpolate=False).get("MESSAGE_API_ACCESS_TOKEN") or "").strip()
        if not token:
            token = await init_login(http, settings, token)
        else:
            http.headers["Authorization"] = f"Bearer {token}"
            response = await http.get("/api/auth/me")
            if response.status_code != 200:
                token = await init_login(http, settings, token)

        http.headers["Authorization"] = f"Bearer {token}"
        yield http


def check_response(response):
    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == 200
    return payload


async def test_chat_complete(client, settings):
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("聊天集成测试需要配置 DEEPSEEK_API_KEY")
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id="placeholder",
        session_title="message-api-test-" + uuid4().hex,
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
        tools=[],
        messages=[MessageRequest(id=time.time_ns() // 1000, role="user", content="请只回复 OK")],
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
        messages=[MessageRequest(id=time.time_ns() // 1000, role="user", content="请写一首五言绝句给我")],
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
