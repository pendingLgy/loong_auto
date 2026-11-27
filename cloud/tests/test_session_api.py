"""会话接口集成测试：执行前必须单独启动 cloud 服务。

使用 `loong-cloud-client` 的 `CloudClient` 验证 `/api/sessions` 的新增、编辑、
详情与分页接口。测试会保留唯一命名的工作目录与会话数据。
运行：python -m pytest cloud/tests/test_session_api.py -v -s
"""
import json
from uuid import uuid4

import pytest
from conftest import _cloud
from httpx import HTTPStatusError
from loong_cloud_client.client import CloudClient
from loong_contracts.request.session import CreateSessionRequest, UpdateSessionRequest
from loong_contracts.request.working_directory import CreateWorkingDirectoryRequest
from loong_contracts.response.session import SessionSimpleResponse


async def _create_workspace(cloud: CloudClient, label: str):
    name = f"{label}-{uuid4().hex}"

    workspaces: list[str] = [f"F:/tmp/{name}"]

    await cloud.workspaces.create(CreateWorkingDirectoryRequest(name=name, path=workspaces))
    page = await cloud.workspaces.list(page=1, page_size=100)
    workspace = next((row for row in page.rows or [] if row.name == name), None)
    assert workspace is not None, "工作目录创建后未查询到"
    return workspace


async def _create_session(cloud: CloudClient, workspace_id: int, label: str) -> SessionSimpleResponse:
    session_id = f"session-{uuid4().hex}"
    result = await cloud.sessions.create(
        CreateSessionRequest(
            session_id=session_id,
            session_title=f"{label}-{uuid4().hex}",
            workspace_id=workspace_id,
        )
    )
    assert isinstance(result.data, SessionSimpleResponse)
    return result.data


async def test_create_and_get_session(client):
    cloud = _cloud(client)
    workspace = await _create_workspace(cloud, "session-create")
    session = await _create_session(cloud, workspace.id, "session-create")

    assert session.workspace_id == workspace.id
    assert session.session_id.startswith("session-")

    detail = await cloud.sessions.get(session.session_id,workspace.id)
    assert isinstance(detail.data, SessionSimpleResponse)
    assert detail.data.id == session.id
    assert detail.data.session_id == session.session_id
    assert detail.data.session_title == session.session_title
    assert detail.data.workspace_id == workspace.id


async def test_create_duplicate_session(client):
    cloud = _cloud(client)
    workspace = await _create_workspace(cloud, "session-duplicate")
    session = await _create_session(cloud, workspace.id, "session-duplicate")

    with pytest.raises(HTTPStatusError, match="400 Bad Request"):
        await cloud.sessions.create(
            CreateSessionRequest(
                session_id=session.session_id,
                session_title="duplicate",
                workspace_id=workspace.id,
            )
        )


async def test_create_session_with_unknown_workspace(client):
    cloud = _cloud(client)

    with pytest.raises(HTTPStatusError,match="400 Bad Request"):
        await cloud.sessions.create(
            CreateSessionRequest(
                session_id=f"session-{uuid4().hex}",
                session_title="unknown-workspace",
                workspace_id=10**18,
            )
        )


async def test_update_session(client):
    cloud = _cloud(client)
    workspace = await _create_workspace(cloud, "session-update")
    other_workspace = await _create_workspace(cloud, "session-update-target")
    session = await _create_session(cloud, workspace.id, "session-update")

    new_title = f"updated-{uuid4().hex}"
    await cloud.sessions.update(
        session.session_id,
        UpdateSessionRequest(session_title=new_title,workspace_id=workspace.id),
    )

    await cloud.sessions.update(
        session.session_id,
        UpdateSessionRequest(workspace_id=other_workspace.id),
    )

    detail = await cloud.sessions.get(session.session_id,workspace_id=workspace.id)
    assert detail.data.workspace_id == workspace.id


async def test_update_session_with_unknown_workspace(client):
    cloud = _cloud(client)
    workspace = await _create_workspace(cloud, "session-update-unknown")
    session = await _create_session(cloud, workspace.id, "session-update-unknown")

    result = await cloud.sessions.update(
        session.session_id,
        UpdateSessionRequest(workspace_id=10**18),
    )
    assert result.code == 404


async def test_update_session_not_found(client):
    cloud = _cloud(client)
    result = await cloud.sessions.update(
        f"nonexistent-{uuid4().hex}",
        UpdateSessionRequest(session_title="missing",workspace_id=000),
    )
    assert result.code == 404


async def test_get_session_not_found(client):
    cloud = _cloud(client)
    result = await cloud.sessions.get(f"nonexistent-{uuid4().hex}",workspace_id=0)
    assert result.code == 404


async def test_list_sessions_by_workspace(client):
    cloud = _cloud(client)
    workspace = await _create_workspace(cloud, "session-list")
    other_workspace = await _create_workspace(cloud, "session-list-other")

    first = await _create_session(cloud, workspace.id, "session-list")
    second = await _create_session(cloud, workspace.id, "session-list")
    await _create_session(cloud, other_workspace.id, "session-list-other")

    page = await cloud.sessions.list(workspace_id=workspace.id, page=1, page_size=10)
    assert page.rows is not None
    assert page.total is not None and page.total >= 2
    assert all(isinstance(row, SessionSimpleResponse) for row in page.rows)
    assert all(row.workspace_id == workspace.id for row in page.rows)
    assert {row.session_id for row in page.rows} >= {first.session_id, second.session_id}

    limited = await cloud.sessions.list(workspace_id=workspace.id, page=1, page_size=1)
    assert limited.page == 1
    assert limited.page_size == 1
    assert limited.rows is not None and len(limited.rows) == 1
