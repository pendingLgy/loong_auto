"""真实 HTTP 集成测试：执行前必须单独启动 cloud 服务。

使用 `loong-cloud-client` 的 `CloudClient` 验证消息、工作目录与会话接口。
配置读取 cloud/.env.api_key，也支持同名环境变量覆盖：
MESSAGE_API_BASE_URL（默认 http://127.0.0.1:9527）、MESSAGE_API_ACCESS_TOKEN，
或 MESSAGE_API_USERNAME / MESSAGE_API_PASSWORD；聊天需要 DEEPSEEK_API_KEY。
运行：python -m pytest cloud/tests/test_message_api.py -v -s
测试会在指定服务数据库中保留唯一命名的测试工作目录与会话。
"""
import json
import time
from uuid import uuid4

import pytest
from conftest import _cloud
from loong_cloud_client.client import CloudClient
from loong_contracts.agent.models import Message
from loong_contracts.common.llm_message_constant import GlobalMessageRole
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest
from loong_contracts.request.session import CreateSessionRequest, UpdateSessionRequest
from loong_contracts.request.working_directory import CreateWorkingDirectoryRequest
from loong_contracts.response.session import SessionSimpleResponse


async def _create_workspace(cloud: CloudClient, name: str):
    workspaces: list[str] = [f"F:/tmp/{name}"]

    await cloud.workspaces.create(CreateWorkingDirectoryRequest(name=name, path=workspaces))
    page = await cloud.workspaces.list(page=1, page_size=100)
    workspace = next((row for row in page.rows or [] if row.name == name), None)
    assert workspace is not None, "工作目录创建后未查询到"
    return workspace


async def _create_session(cloud: CloudClient, workspace_id: int, session_id: str, session_title: str):
    await cloud.sessions.create(
        CreateSessionRequest(
            session_id=session_id,
            session_title=session_title,
            workspace_id=workspace_id,
        )
    )
    detail = await cloud.sessions.get(session_id,workspace_id)
    assert isinstance(detail.data, SessionSimpleResponse)
    return detail.data


async def test_chat_complete(client, settings):
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("聊天集成测试需要配置 DEEPSEEK_API_KEY")

    cloud = _cloud(client)
    name = "message-api-test-" + uuid4().hex
    workspace = await _create_workspace(cloud, name)
    session_id = "session-" + uuid4().hex
    await _create_session(cloud, workspace.id, session_id, name)

    body = AddMessageRequest(
        tenant_id=0, user_id=0, workspace_id=workspace.id,
        session_id=session_id,
        session_title=name,
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
        tools=[],
        messages=[Message(id=str(time.time_ns() // 1000), role=GlobalMessageRole.USER, content="请只回复 OK")],
    )

    client_id = "client-" + uuid4().hex
    result = await cloud.messages.complete(client_id, workspace.id, session_id, body)
    print(f"\n{result.model_dump_json(ensure_ascii=False)}")
    messages = result.data.messages
    assert messages[-1].role == "assistant"
    assert messages[-1].content.strip()

    detail = await cloud.sessions.get(session_id,workspace.id)
    assert detail.data.session_id == session_id
    assert detail.data.workspace_id == workspace.id

    # 相同消息再次提交应进入重复消息分支，不再次调用模型。
    result2 = await cloud.messages.complete(client_id, workspace.id, session_id, body)
    print(f"\n{result2.model_dump_json(ensure_ascii=False)}")

async def test_chat_sse(client, settings):
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("聊天集成测试需要配置 DEEPSEEK_API_KEY")

    cloud = _cloud(client)
    name = "message-api-test-" + uuid4().hex
    workspace = await _create_workspace(cloud, name)
    session_id = "session-" + uuid4().hex
    await _create_session(cloud, workspace.id, session_id, name)

    body = AddMessageRequest(
        tenant_id=0, user_id=0, workspace_id=workspace.id,
        session_id=session_id,
        session_title=name,
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
        tools=[],
        messages=[Message(id=str(time.time_ns() // 1000), role=GlobalMessageRole.USER, content="请写一首五言绝句给我")],
    )

    client_id = "client-" + uuid4().hex
    response = await cloud.messages.stream(client_id, session_id, body)
    try:
        assert response.headers["content-type"].startswith("text/event-stream")

        lines = []
        async for line in response.aiter_lines():
            lines.append(line)

        raw_response_str = "\n".join(lines)
        print("完整原始字符串:\n", raw_response_str)
        assert raw_response_str
    finally:
        await response.aclose()


async def test_update_session(client):
    cloud = _cloud(client)
    name = "message-api-test-" + uuid4().hex
    workspace = await _create_workspace(cloud, name)
    session_id = "session-" + uuid4().hex
    await _create_session(cloud, workspace.id, session_id, name)

    new_title = name + "-updated"
    await cloud.sessions.update(
        session_id,
        UpdateSessionRequest(session_title=new_title,workspace_id=workspace.id),
    )

    new = await cloud.sessions.get(session_id,workspace.id)

    assert new.data.session_title == new_title
    assert new.data.workspace_id == workspace.id

