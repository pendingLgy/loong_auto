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
from conftest import PATH_CLOUD_MESSAGE_PREFIX, PATH_CLOUD_SSE_PREFIX, SESSION_CONFIG_PATH, _create_session, _create_workspace
from loong_contracts.agent.models import Message
from loong_contracts.common.llm_message_constant import (
    GlobalMessageRole,
    GlobalMessageStatus,
)
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest
from pydantic import SecretStr

from loong_local.install_setting import init_tools
from loong_local.tools.base_tool import ToolSuspendedError
from loong_local.tools.registry import GLOBAL_TOOL_REGISTRY
from loong_local.tools.security import (
    PathGuard,
    SandboxConfig,
    ToolGuard,
    ToolPermissionGuard,
    WorkspaceMode,
    WorkspacePolicy,
)
from loong_local.tools.tool_executor import ToolCallRequest, ToolExecutor

APPROVE_PATH = "/api/tools/{session_id}/approved/{tool_id}"
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


async def approve_pending_tool(client, session_id: str, tool_id: str) -> dict:
    """等待后台 Worker 落库后提交审批，返回执行结果对应的 tool 消息。"""
    for _ in range(20):
        response = await client.post(
            APPROVE_PATH.format(session_id=session_id, tool_id=tool_id),
            json={"approved": True})
        if response.status_code == 200:
            return response.json()["data"]
        if response.status_code != 404:
            pytest.fail(f"审批接口异常：{response.status_code} {response.text}")
        # 挂起任务由 subscribe 的后台 Worker 异步写入，稍等后重试。
        await asyncio.sleep(0.1)
    pytest.fail("待审批任务未在超时时间内落库")


async def ensure_session_config(client, session_id: str, workspace_id:int, path, *, mode: str = "full") -> None:
    """调用 session_config_api 登记本次会话的放行策略与工作目录。"""

    created = await client.put(SESSION_CONFIG_PATH.format(session_id=session_id),
                               json={
                                   "workspace_mode": mode,
                                   "workspace_id": workspace_id,
                                   "workspaces": [str(path)]
                               })
    assert created.status_code == 200, created.text


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

    workspace_id = await _create_workspace(client, str(tmp_path))
    await _create_session(client, session_id, workspace_id, "session-test")
    await ensure_session_config(client, session_id, workspace_id, tmp_path)

    provider = settings("SSE_TEST_PROVIDER", "deepseek")
    model = settings("SSE_TEST_MODEL", "deepseek-chat")
    tool_definition = GLOBAL_TOOL_REGISTRY.get_group_definition(TOOL_NAME)
    assert tool_definition.location == "remote"

    # 两次提交共用同一份请求参数，只有 messages 不同。
    common_body = AddMessageRequest(
        # 云端以认证身份覆盖这两个字段，这里只需满足契约校验。
        tenant_id=0,
        user_id=0,
        session_id=session_id,
        workspace_id=workspace_id,
        session_title="工具调用测试",
        llm=LLMParamRequest(provider=provider, model=model, temperature=0,
                            api_key=SecretStr(api_key)),
        tools=[tool_definition],
        messages=[]
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

    response = await client.send(client.build_request("GET", PATH_CLOUD_SSE_PREFIX), stream=True)
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

                common_body.messages = pending_messages
                body = common_body

                payload = body.model_dump(mode="json")
                # SecretStr 默认脱敏，只在本次提交时显式取出密钥。
                payload["llm"]["api_key"] = api_key
                submitted = await client.post(PATH_CLOUD_MESSAGE_PREFIX.format(session_id=session_id),
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


async def test_dangerous_tool_call_requires_manual_approval(client, settings, tmp_path):
    """危险工具在 workspace_write 模式下必须审批：审批前不执行，审批后才真正落盘。"""
    api_key = settings("DEEPSEEK_API_KEY").strip()
    if not api_key:
        pytest.skip("未配置 DEEPSEEK_API_KEY，跳过真实模型测试")

    TOOL_NAME = "shell_command"
    if TOOL_NAME not in GLOBAL_TOOL_REGISTRY.list_tool_names():
        init_tools()

    session_id = f"session_{uuid4().hex}"

    client.headers["x-session-id"] = session_id

    workspace_id = await _create_workspace(client, str(tmp_path))
    await _create_session(client, session_id, workspace_id, "session-test")
    await ensure_session_config(client, session_id, workspace_id, tmp_path)

    marker = tmp_path / "approval_marker.txt"
    command = (f"New-Item -ItemType File -Force -Path '{marker.name}'"
               if os.name == "nt" else f"touch {marker.name}")

    provider = settings("SSE_TEST_PROVIDER", "deepseek")
    model = settings("SSE_TEST_MODEL", "deepseek-chat")
    tool_definition = GLOBAL_TOOL_REGISTRY.get_group_definition(TOOL_NAME)
    assert tool_definition.location == "remote"

    common_body = AddMessageRequest(
        tenant_id=0,
        user_id=0,
        session_id=session_id,
        workspace_id=workspace_id,
        session_title="工具审批测试",
        llm=LLMParamRequest(provider=provider, model=model, temperature=0,
                            api_key=SecretStr(api_key)),
        tools=[tool_definition],
        messages=[]
    )

    pending_messages = [
        Message(id=uuid4().hex, role=GlobalMessageRole.USER,
                content=f"请调用 {TOOL_NAME} 工具执行命令：{command}。"
                        f"这是创建文件的操作，dangerous 标记为 true，不要执行其他命令。")
    ]
    client_id = None
    tool_executed = False
    final = None

    response = await client.send(client.build_request("GET", PATH_CLOUD_SSE_PREFIX), stream=True)
    try:
        stream = SSEStream(response)

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
                common_body.messages = pending_messages
                body = common_body
                payload = body.model_dump(mode="json")
                payload["llm"]["api_key"] = api_key
                submitted = await client.post(PATH_CLOUD_MESSAGE_PREFIX.format(session_id=session_id),
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

                assert len(tool_calls) == 1
                call = tool_calls[0]
                assert call["name"] == TOOL_NAME
                # 审批前不应产生任何副作用。
                assert not marker.exists(), "危险命令在人工审批前被执行了"

                tool_message = await approve_pending_tool(client, session_id, call["id"])
                assert tool_message["role"] == GlobalMessageRole.TOOL.value
                assert tool_message["tool_call_id"] == call["id"]
                assert "Run tool failed" not in tool_message["content"]
                # 审批通过后才真正执行。
                assert marker.exists(), "审批通过后命令仍未执行"

                tool_executed = True
                assistant = Message.model_validate(data["messages"][-1])
                assert assistant.role == GlobalMessageRole.ASSISTANT
                pending_messages = [assistant, Message.model_validate(tool_message)]
                continue

            if event == GlobalMessageStatus.STOP.value:
                assert tool_executed, "模型未触发工具调用，事件流直接结束"
                final = data
                break
    finally:
        await response.aclose()
        await client.delete(f"/api/session-configs/{session_id}")

    assert final is not None
    assert final["error"] is False
    messages = final["messages"]
    assert messages[-1]["role"] == GlobalMessageRole.ASSISTANT.value
    assert messages[-1]["content"].strip()
    assert any(message["role"] == GlobalMessageRole.TOOL.value for message in messages)


async def test_mixed_tool_calls_execute_in_tool_call_order(client, settings, tmp_path):
    """一次响应里混合多个工具：只读工具直接执行，危险工具走审批，且严格按 tool_calls 顺序。"""
    api_key = settings("DEEPSEEK_API_KEY").strip()
    if not api_key:
        pytest.skip("未配置 DEEPSEEK_API_KEY，跳过真实模型测试")

    if "read_file" not in GLOBAL_TOOL_REGISTRY.list_tool_names():
        init_tools()

    session_id = f"session_{uuid4().hex}"

    workspace_id = await _create_workspace(client, str(tmp_path))
    await _create_session(client, session_id, workspace_id, "session-test")
    await ensure_session_config(client, session_id, workspace_id, tmp_path)

    sample = tmp_path / "sample.txt"
    sample.write_text("mixed tool sample", encoding="utf-8")
    written = tmp_path / "approval_demo.txt"

    provider = settings("SSE_TEST_PROVIDER", "deepseek")
    model = settings("SSE_TEST_MODEL", "deepseek-chat")
    tool_definitions = [GLOBAL_TOOL_REGISTRY.get_group_definition(name)
                        for name in ("read_file", "write_file")]

    common_body = AddMessageRequest(
        tenant_id=0,
        user_id=0,
        session_id=session_id,
        workspace_id=workspace_id,
        session_title="混合工具测试",
        llm=LLMParamRequest(provider=provider, model=model, temperature=0,
                            api_key=SecretStr(api_key)),
        tools=tool_definitions,
        messages=[]
    )

    pending_messages = [
        Message(id=uuid4().hex, role=GlobalMessageRole.USER,
                content="请在同一轮里调用两个工具：先用 read_file 读取 sample.txt，"
                        "再用 write_file 把内容 approved 写入 approval_demo.txt。"
                        "不要调用其他工具。")
    ]
    client_id = None
    mixed_executed = False
    final = None

    executor = ToolExecutor(
        registry=GLOBAL_TOOL_REGISTRY,
        tool_guard=ToolGuard(allowed_tools=GLOBAL_TOOL_REGISTRY.list_tool_names()),
        permission_guard=ToolPermissionGuard(),
        path_guard=PathGuard(),
        sandbox_config=SandboxConfig(),
    )

    response = await client.send(client.build_request("GET", PATH_CLOUD_SSE_PREFIX), stream=True)
    try:
        stream = SSEStream(response)

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
                common_body.messages = pending_messages
                body = common_body
                payload = body.model_dump(mode="json")
                payload["llm"]["api_key"] = api_key
                submitted = await client.post(PATH_CLOUD_MESSAGE_PREFIX.format(session_id=session_id),
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
                if mixed_executed:
                    pytest.fail("模型在回传工具结果后再次请求工具调用")

                names = [call["name"] for call in tool_calls]
                assert set(names) == {"read_file", "write_file"}, f"模型未按预期调用工具：{names}"

                assistant = Message.model_validate(data["messages"][-1])
                assert assistant.role == GlobalMessageRole.ASSISTANT

                tool_messages: list[Message] = []
                for call in tool_calls:
                    tool = GLOBAL_TOOL_REGISTRY.create_tool_instance(call["name"])
                    if tool.requires_approval:
                        # 危险工具：必须走人工审批，由审批接口执行。
                        message = await approve_pending_tool(client, session_id, call["id"])
                    else:
                        # 只读工具：直接执行，不触发审批。
                        result = await executor.execute(
                            ToolCallRequest(tool_id=call["id"], tool_name=call["name"],
                                            arguments=call["arguments"]),
                            policy=WorkspacePolicy(mode=WorkspaceMode.WORKSPACE_WRITE),
                            workspaces=(tmp_path,))
                        message = Message(id=uuid4().hex, role=GlobalMessageRole.TOOL,
                                          status=GlobalMessageStatus.TOOL_CALLED,
                                          tool_call_id=call["id"],
                                          content=result.model_dump_json()).model_dump(mode="json")
                    assert message["tool_call_id"] == call["id"]
                    tool_messages.append(Message.model_validate(message))

                # 严格按 tool_calls 顺序返回结果。
                assert [message.tool_call_id for message in tool_messages] == \
                       [call["id"] for call in tool_calls]
                # 危险工具必须审批后才落盘。
                assert written.exists()
                mixed_executed = True
                pending_messages = [assistant, *tool_messages]
                continue

            if event == GlobalMessageStatus.STOP.value:
                assert mixed_executed, "模型未触发工具调用，事件流直接结束"
                final = data
                break
    finally:
        await response.aclose()
        await client.delete(f"/api/session-configs/{session_id}")

    assert final is not None
    assert final["error"] is False
    assert written.exists()
    assert written.read_text(encoding="utf-8") == "approved"
    messages = final["messages"]
    assert messages[-1]["role"] == GlobalMessageRole.ASSISTANT.value
    tool_message_ids = [message["tool_call_id"] for message in messages
                        if message["role"] == GlobalMessageRole.TOOL.value]
    assert tool_message_ids
