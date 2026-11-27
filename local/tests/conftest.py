"""本地接口测试公共配置；不污染进程环境变量。"""
import hashlib
import json
import os
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from dotenv import dotenv_values, set_key
from loong_cloud_client import CloudClient
from loong_contracts.request.login import LoginRequest
from loong_contracts.request.session import CreateSessionRequest
from loong_contracts.request.working_directory import CreateWorkingDirectoryRequest
from loong_contracts.response.session import SessionSimpleResponse

CONFIG_PATH = Path(__file__).resolve().parents[1] / ".env.test"


def _write_setting(name: str, value: str) -> None:
    """写入 .env.test，并记录更新时间注释。"""
    set_key(str(CONFIG_PATH), name, value, encoding="utf-8")
    prefix = f"# {name} 更新时间："
    lines = [line for line in CONFIG_PATH.read_text(encoding="utf-8").splitlines()
             if not line.startswith(prefix)]
    index = next(i for i, line in enumerate(lines) if line.startswith(f"{name}="))
    lines.insert(index, prefix + datetime.now().astimezone().isoformat(timespec="seconds"))
    CONFIG_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _user_token_from_login(data) -> str:
    """根据登录用户 id + username 生成稳定的用户身份令牌。"""
    user = (getattr(data, "user_info", None)
            or getattr(data, "user", None) or {})
    user_id = user.get("id") if isinstance(user, dict) else getattr(user, "id", None)
    username = user.get("username") if isinstance(user, dict) else getattr(user, "username", None)
    if user_id is None or not username:
        pytest.fail("登录响应缺少 data.user_info.id / username")
    return hashlib.sha256(f"{user_id}:{username}".encode("utf-8")).hexdigest()

@pytest.fixture(scope="session")
def settings():
    def read(name: str, default: str = "") -> str:
        values = dotenv_values(CONFIG_PATH, interpolate=False, encoding="utf-8")
        return os.environ.get(name, values.get(name) or default)

    return read


@pytest.fixture
async def http_client(settings):
    """未认证 HTTP 客户端，所有请求均访问 local 网关。"""
    async with httpx.AsyncClient(
        base_url=settings("LOCAL_API_BASE_URL", "http://127.0.0.1:8765"),
        timeout=float(settings("LOCAL_API_TIMEOUT", "180")),
        follow_redirects=False, trust_env=False,
    ) as client:
        client.headers["x-security-token"] = settings("SECURITY_TOKEN")
        yield client

SESSION_CONFIG_PATH = "/api/session-configs/{session_id}"

PATH_CLOUD_PREFIX = "api/cloud"
PATH_CLOUD_COMMON_PREFIX = f"{PATH_CLOUD_PREFIX}/common"
PATH_CLOUD_MESSAGE_PREFIX = f"{PATH_CLOUD_PREFIX}/session/"+"{session_id}/message"
PATH_CLOUD_SSE_PREFIX = f"{PATH_CLOUD_PREFIX}/sse/subscribe"

@pytest.fixture()
async def client(http_client, settings):
    """返回带默认认证头的 HTTP 客户端，令牌失效时重新登录。"""
    auth = CloudClient(http_client,prefix=f"{PATH_CLOUD_COMMON_PREFIX}").auth
    token = settings("LOCAL_API_ACCESS_TOKEN").strip()
    user_token = settings("LOCAL_API_USER_TOKEN").strip()

    if token and user_token:
        http_client.headers["Authorization"] = f"Bearer {token}"
        http_client.headers["X-User-Token"] = user_token
        try:
            await auth.me()
            yield http_client
            return
        except httpx.HTTPStatusError as exc:
            print(f"{exc.response.text}")
            if exc.response.status_code != 401:
                raise
        http_client.headers.pop("Authorization", None)
        http_client.headers.pop("X-User-Token", None)

    username = settings("LOCAL_API_USERNAME")
    password = settings("LOCAL_API_PASSWORD")
    if not username or not password:
        pytest.fail("请在 local/.env.test 配置已注册的 LOCAL_API_USERNAME / LOCAL_API_PASSWORD")
    result = await auth.login(LoginRequest(
        username=username, password=password,
        platform=settings("LOCAL_API_PLATFORM", "tui"),
    ))
    token = result.data.access_token
    _write_setting("LOCAL_API_ACCESS_TOKEN", token)

    user_token = _user_token_from_login(result.data)
    _write_setting("LOCAL_API_USER_TOKEN", user_token)

    http_client.headers["Authorization"] = f"Bearer {token}"
    http_client.headers["X-User-Token"] = user_token
    yield http_client


async def _create_workspace(client, path) -> int:
    name = f"tpm_workspace-{uuid4().hex}"

    workspaces: list[str] = [f"{path}"]

    cloud = CloudClient(client,prefix=PATH_CLOUD_COMMON_PREFIX)
    await cloud.workspaces.create(CreateWorkingDirectoryRequest(name=name, path=workspaces))
    page = await cloud.workspaces.list(page=1, page_size=100)
    workspace = next((row for row in page.rows or [] if row.name == name), None)
    assert workspace is not None, "工作目录创建后未查询到"

    return workspace.id


async def _create_session(client, session_id: str, workspace_id: int, label: str) -> str:
    cloud = CloudClient(client, prefix=PATH_CLOUD_COMMON_PREFIX)

    result = await cloud.sessions.create(
        CreateSessionRequest(
            session_id=session_id,
            session_title=f"{label}-{uuid4().hex}",
            workspace_id=workspace_id,
        )
    )
    assert isinstance(result.data, SessionSimpleResponse)
    return session_id
