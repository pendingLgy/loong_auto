"""工具调用测试：订阅 local 的 SSE，触发真实模型工具调用，本地执行后再次提交消息。

完整链路：

1. ``GET /sse/subscribe`` 建立事件流，connected 首帧取 client_id；
2. 订阅完成后进入 ``while`` 循环统一处理：有待提交消息时先提交，再消费推送；
3. 收到 ``remote_tool_calls`` 时用 ``GLOBAL_TOOL_REGISTRY.get_group_definition`` 解析工具、
   ``ToolExecutor`` 执行，并把 assistant 调用消息与 tool 结果消息作为下一批待提交消息；
4. 收到 ``stop`` 时结束循环并校验最终回答。

工具真实执行（当前为只读命令），不使用 mock；会真实调用模型并保留会话记录，
未配置 ``DEEPSEEK_API_KEY`` 时跳过。访问令牌与请求客户端由 ``client`` fixture 提供
（见 local/tests/conftest.py），配置读取 local/.env.test，同名环境变量优先。
"""
import asyncio
import json
import os
from uuid import uuid4

import httpx
import pytest
from pydantic import SecretStr

from loong_contracts.agent.models import Message
from loong_contracts.common.llm_message_constant import GlobalMessageRole, GlobalMessageStatus
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest
from loong_local.install_setting import init_tools
from loong_local.tools.base_tool import ToolSuspendedError
from loong_local.tools.registry import GLOBAL_TOOL_REGISTRY
from loong_local.tools.security import (PathGuard, SandboxConfig, ToolGuard,
                                        ToolPermissionGuard, WorkspaceMode, WorkspacePolicy)
from loong_local.tools.tool_executor import ToolCallRequest, ToolExecutor

SUBSCRIBE_PATH = "/api/sse/subscribe"
MESSAGE_PATH = "/api/session/{session_id}/message"
EVENT_TIMEOUT_SECONDS = 120



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


async def test_subscribe_execute_tool_and_resubmit(client, settings, tmp_path):
    """订阅 SSE 后用 while 循环处理推送：触发工具调用、本地执行、再次提交并读到最终回答。"""
    api_key = settings("DEEPSEEK_API_KEY").strip()
    if not api_key:
        pytest.skip("未配置 DEEPSEEK_API_KEY，跳过真实模型测试")

    TOOL_NAME = "shell_command"
    # 测试进程没有走网关启动流程，这里手动完成工具注册。
    if TOOL_NAME not in GLOBAL_TOOL_REGISTRY.list_tool_names():
        init_tools()

    sample = tmp_path / "tool_call_sample.txt"
    sample.write_text("tool call sample", encoding="utf-8")

    session_id = f"session_{uuid4().hex}"
    # 建立连接前先登记会话配置：工作目录用 tmp_path，允许完整权限，工具无需审批。
    created = await client.put(f"/api/session-configs/{session_id}",
                               json={"workspace_mode": "full", "workspaces": [str(tmp_path)]})
    assert created.status_code == 200, created.text
    client.headers["x-session-id"] = session_id

    provider = settings("SSE_TEST_PROVIDER", "deepseek")
    model = settings("SSE_TEST_MODEL", "deepseek-chat")
    tool_definition = GLOBAL_TOOL_REGISTRY.get_group_definition(TOOL_NAME)
    assert tool_definition.location == "remote"

    # 两次提交共用同一份请求参数，只有 messages 不同。
    common_body = dict(
        # 云端以认证身份覆盖这两个字段，这里只需满足契约校验。
        tenant_id=0,
        user_id=0,
        session_id=session_id,
        session_title="工具调用测试",
        llm=LLMParamRequest(provider=provider, model=model, temperature=0,
                            api_key=SecretStr(api_key)),
        tools=[tool_definition],
    )

    # 循环状态：待提交消息、连接标识、工具执行标记与最终事件。
    pending_messages = [
        Message(id=uuid4().hex, role=GlobalMessageRole.USER,
                content=f"请调用 {TOOL_NAME} 工具执行命令列出当前目录"
                        f"（工作目录 {tmp_path}）的内容，"
                        f"dangerous 标记为 false，不要执行其他命令。")
    ]
    client_id = None
    tool_executed = False
    final = None

    response = await client.send(client.build_request("GET", SUBSCRIBE_PATH), stream=True)
    try:
        stream = SSEStream(response)

        # 订阅完成后统一由该循环处理：先取 connected 首帧，再提交待发送消息、消费推送。
        while True:
            if client_id is None:
                assert response.status_code == 200, await response.aread()
                assert response.headers["content-type"].startswith("text/event-stream")
                event, data = await stream.next_event()
                assert event == GlobalMessageStatus.CONNECTED.value
                client_id = data["client_id"]
                assert client_id
                continue

            if pending_messages:
                body = AddMessageRequest(**common_body, messages=pending_messages)
                payload = body.model_dump(mode="json")
                # SecretStr 默认脱敏，只在本次提交时显式取出密钥。
                payload["llm"]["api_key"] = api_key
                submitted = await client.post(MESSAGE_PATH.format(session_id=session_id),
                                              json=payload)
                assert submitted.status_code == 200
                assert submitted.json()["code"] == 200
                pending_messages = None

            event, data = await stream.next_event()
            if event == GlobalMessageStatus.HEARTBEAT.value:
                continue
            assert data.get("session_id") == session_id

            tool_calls = data.get("remote_tool_calls")
            if tool_calls:
                assert event == GlobalMessageStatus.TOOL_CALLING.value
                if tool_executed:
                    pytest.fail("模型在回传工具结果后再次请求工具调用")
                tool_executed = True

                assert len(tool_calls) == 1
                call = tool_calls[0]
                assert call["name"] == TOOL_NAME
                # remote 表示由本地执行，云端不会直接操作用户工作区。
                assert call["location"] == "remote"
                assert call["id"]

                # 通过统一执行入口解析并真实执行工具。
                tool_name = call["name"]
                tool_id = call["id"]
                arguments = dict(call["arguments"])

                definition = GLOBAL_TOOL_REGISTRY.get_group_definition(tool_name)
                assert definition.name == TOOL_NAME

                executor = ToolExecutor(
                    registry=GLOBAL_TOOL_REGISTRY,
                    tool_guard=ToolGuard(
                        allowed_tools=GLOBAL_TOOL_REGISTRY.list_tool_names()),
                    permission_guard=ToolPermissionGuard(),
                    path_guard=PathGuard(),
                    sandbox_config=SandboxConfig(),
                )
                try:
                    result = await executor.execute(
                        ToolCallRequest(tool_id=tool_id, tool_name=tool_name,
                                        arguments=arguments),
                        policy=WorkspacePolicy(mode=WorkspaceMode.FULL),
                        workspaces=(tmp_path,))
                except ToolSuspendedError as exc:
                    pytest.fail(f"模型选择了需要人工审批的命令，用例只执行只读命令：{exc.summary}")

                assert result.exit_code == 0
                assert sample.name in result.stdout

                # 组装回传消息：assistant 调用消息 + tool 结果消息，交给下一轮提交。
                assistant = Message.model_validate(data["messages"][-1])
                assert assistant.role == GlobalMessageRole.ASSISTANT
                assert assistant.tool_calls
                assert assistant.tool_calls[0].id == call["id"]

                tool_message = Message(
                    id=uuid4().hex,
                    role=GlobalMessageRole.TOOL,
                    status=GlobalMessageStatus.TOOL_CALLED,
                    tool_call_id=call["id"],
                    content=result.model_dump_json(),
                )
                pending_messages = [assistant, tool_message]
                continue

            if event == GlobalMessageStatus.STOP.value:
                assert tool_executed, "模型未触发工具调用，事件流直接结束"
                final = data
                break
    finally:
        await response.aclose()
        # 清理本次会话配置，避免在网关数据库中残留测试数据。
        await client.delete(f"/api/session-configs/{session_id}")

    assert final is not None
    assert final["error"] is False
    messages = final["messages"]
    assert messages[-1]["role"] == GlobalMessageRole.ASSISTANT.value
    assert messages[-1]["content"].strip()
    # 工具结果已写入会话上下文，最终回答基于真实执行结果。
    assert any(message["role"] == GlobalMessageRole.TOOL.value for message in messages)
