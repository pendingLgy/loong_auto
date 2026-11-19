"""proxy_sse_api 真实集成测试：先单独启动 cloud 与 local 网关。

用例均通过 ``GET /sse/subscribe`` 建立真实事件流，订阅与关闭都由用例自己处理，
不使用 mock、不替换传输层：

- ``test_subscribe_streams_heartbeat_when_idle``：连接空闲时按云端间隔收到 heartbeat。
- ``test_subscribe_then_submit_message``：提交一条消息后，在同一条事件流上读到
  真实模型输出，直到 stop 帧。

访问令牌与请求客户端由 ``client`` fixture 提供（见 local/tests/conftest.py），
用例内不单独登录。消息用例会真实调用模型并保留会话记录，未配置
``DEEPSEEK_API_KEY`` 时跳过。配置读取 local/.env.test，同名环境变量优先：

- ``LOCAL_API_USERNAME`` / ``LOCAL_API_PASSWORD`` / ``LOCAL_API_PLATFORM``：已注册的测试账号。
- ``SSE_TEST_PROVIDER`` / ``SSE_TEST_MODEL``：模型供应商与名称，默认 deepseek / deepseek-chat。
"""
import asyncio
import json
import time
from uuid import uuid4

import httpx
import pytest
from pydantic import SecretStr

from loong_contracts.agent.models import Message
from loong_contracts.common.llm_message_constant import GlobalMessageRole, GlobalMessageStatus
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest

SUBSCRIBE_PATH = "/api/sse/subscribe"
MESSAGE_PATH = "/api/session/{session_id}/message"
SESSION_CONFIG_PATH = "/api/session-configs/{session_id}"
EVENT_TIMEOUT_SECONDS = 120

# 云端空闲心跳间隔为 15 秒，等待时间与间隔校验都留出余量，避免偶发抖动导致误判。
HEARTBEAT_INTERVAL_SECONDS = 15
HEARTBEAT_WAIT_SECONDS = 40
HEARTBEAT_MIN_INTERVAL_SECONDS = 10
HEARTBEAT_MAX_INTERVAL_SECONDS = 35


async def ensure_session_config(client, session_id: str, workspace, *, mode: str = "full") -> None:
    """调用 session_config_api 登记本次会话的放行策略与工作目录。"""
    created = await client.put(SESSION_CONFIG_PATH.format(session_id=session_id),
                               json={"workspace_mode": mode,
                                     "workspaces": [str(workspace)]})
    assert created.status_code == 200, created.text
    client.headers["x-session-id"] = session_id


async def drop_session_config(client, session_id: str) -> None:
    """删除测试期间创建的会话配置，避免污染网关数据库。"""
    removed = await client.delete(SESSION_CONFIG_PATH.format(session_id=session_id))
    assert removed.status_code in (200, 404), removed.text
    client.headers.pop("x-session-id", None)


class SSEStream:
    """保存事件迭代器，避免读取首帧后提前关闭底层连接。"""

    def __init__(self, response: httpx.Response):
        self.response = response
        self._iterator = response.aiter_lines().__aiter__()

    async def next_event(self, timeout: float = EVENT_TIMEOUT_SECONDS) -> tuple[str, dict]:
        async def collect():
            event, data = None, None
            while True:
                line = await self._iterator.__anext__()
                if line.startswith("event:"):
                    event = line[len("event:"):].strip()
                elif line.startswith("data:"):
                    data = line[len("data:"):].strip()
                elif not line and event is not None:
                    return event, data

        event, data = await asyncio.wait_for(collect(), timeout=timeout)
        print(f"\nevent:{event} data:{data}")
        assert data is not None, f"事件 {event} 缺少 data 负载"
        return event, json.loads(data)


async def test_subscribe_streams_heartbeat_when_idle(client, tmp_path):
    """连接空闲时云端按固定间隔推送 heartbeat，local 原样转发且连接保持打开。"""
    session_id = f"sse_heartbeat_{uuid4().hex}"
    await ensure_session_config(client, session_id, tmp_path)

    response = await client.send(client.build_request("GET", SUBSCRIBE_PATH), stream=True)
    try:
        assert response.status_code == 200, await response.aread()
        assert response.headers["content-type"].startswith("text/event-stream")
        stream = SSEStream(response)

        event, connected = await stream.next_event()
        assert event == GlobalMessageStatus.CONNECTED.value
        client_id = connected["client_id"]
        assert client_id

        event, heartbeat = await stream.next_event(timeout=HEARTBEAT_WAIT_SECONDS)
        assert event == GlobalMessageStatus.HEARTBEAT.value
        assert heartbeat["last_message_event"] == GlobalMessageStatus.HEARTBEAT.value
        assert heartbeat["client_id"] == client_id
        assert heartbeat["time"]
        # 心跳是连接级事件，不属于任何业务会话。
        assert "session_id" not in heartbeat

        started = time.monotonic()
        event, second = await stream.next_event(timeout=HEARTBEAT_WAIT_SECONDS)
        interval = time.monotonic() - started

        assert event == GlobalMessageStatus.HEARTBEAT.value
        assert second["client_id"] == client_id
        assert HEARTBEAT_MIN_INTERVAL_SECONDS <= interval <= HEARTBEAT_MAX_INTERVAL_SECONDS, \
            f"心跳间隔 {interval:.1f}s 偏离预期 {HEARTBEAT_INTERVAL_SECONDS}s"
    finally:
        await response.aclose()
        await drop_session_config(client, session_id)


async def test_subscribe_then_submit_message(client, settings, tmp_path):
    """订阅事件流后提交一条消息，事件流应收到本次会话的真实模型输出与 stop 帧。"""
    api_key = settings("DEEPSEEK_API_KEY").strip()
    if not api_key:
        pytest.skip("未配置 DEEPSEEK_API_KEY，跳过真实模型测试")

    session_id = f"sse_test_{uuid4().hex}"
    await ensure_session_config(client, session_id, tmp_path)

    provider = settings("SSE_TEST_PROVIDER", "deepseek")
    model = settings("SSE_TEST_MODEL", "deepseek-chat")

    response = await client.send(client.build_request("GET", SUBSCRIBE_PATH), stream=True)
    try:
        assert response.status_code == 200, await response.aread()
        assert response.headers["content-type"].startswith("text/event-stream")
        stream = SSEStream(response)

        event, connected = await stream.next_event()
        assert event == GlobalMessageStatus.CONNECTED.value
        client_id = connected["client_id"]
        assert client_id

        body = AddMessageRequest(
            # 云端以认证身份覆盖这两个字段，这里只需满足契约校验。
            tenant_id=0,
            user_id=0,
            session_id=session_id,
            session_title="SSE 订阅测试",
            llm=LLMParamRequest(provider=provider, model=model, temperature=0,
                                api_key=SecretStr(api_key)),
            tools=[],
            messages=[Message(id=uuid4().hex, role=GlobalMessageRole.USER, content="请只回复 ok")],
        )
        payload = body.model_dump(mode="json")
        # SecretStr 默认脱敏，只在本次提交时显式取出密钥。
        payload["llm"]["api_key"] = api_key

        submitted = await client.post(MESSAGE_PATH.format(session_id=session_id), json=payload)
        assert submitted.status_code == 200
        accepted = submitted.json()
        assert accepted["code"] == 200

        events: list[tuple[str, dict]] = []
        while True:
            event, data = await stream.next_event()
            if event == GlobalMessageStatus.HEARTBEAT.value:
                continue
            events.append((event, data))
            assert data.get("session_id") == session_id
            if event == GlobalMessageStatus.STOP.value:
                break

        stop_event = events[-1][1]
        assert stop_event["summary"] is True
        assert stop_event["error"] is False
        assert stop_event["messages"]
        assert stop_event["messages"][-1]["role"] == GlobalMessageRole.ASSISTANT.value
        assert stop_event["messages"][-1]["content"]
    finally:
        await response.aclose()
        await drop_session_config(client, session_id)
