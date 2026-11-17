"""本地接口测试公共配置；不污染进程环境变量。"""
import os
from pathlib import Path
from datetime import datetime

import httpx

import pytest
from dotenv import dotenv_values, set_key

from loong_cloud_client import CloudClient
from loong_contracts.request.login import LoginRequest

CONFIG_PATH = Path(__file__).resolve().parents[1] / ".env.test"


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
        yield client


@pytest.fixture(scope="function")
async def client(http_client, settings):
    """返回带默认认证头的 HTTP 客户端，令牌失效时重新登录。"""
    auth = CloudClient(http_client,prefix="common").auth
    token = settings("LOCAL_API_ACCESS_TOKEN").strip()
    if token:
        http_client.headers["Authorization"] = f"Bearer {token}"
        try:
            await auth.me()
            yield http_client
            return
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code != 401:
                raise
        http_client.headers.pop("Authorization", None)

    username = settings("LOCAL_API_USERNAME")
    password = settings("LOCAL_API_PASSWORD")
    if not username or not password:
        pytest.fail("请在 local/.env.test 配置已注册的 LOCAL_API_USERNAME / LOCAL_API_PASSWORD")
    result = await auth.login(LoginRequest(
        username=username, password=password,
        platform=settings("LOCAL_API_PLATFORM", "tui"),
    ))
    token = result.data.access_token
    set_key(str(CONFIG_PATH), "LOCAL_API_ACCESS_TOKEN", token, encoding="utf-8")
    prefix = "# LOCAL_API_ACCESS_TOKEN 更新时间："
    lines = [line for line in CONFIG_PATH.read_text(encoding="utf-8").splitlines()
             if not line.startswith(prefix)]
    index = next(i for i, line in enumerate(lines) if line.startswith("LOCAL_API_ACCESS_TOKEN="))
    lines.insert(index, prefix + datetime.now().astimezone().isoformat(timespec="seconds"))
    CONFIG_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    http_client.headers["Authorization"] = f"Bearer {token}"
    yield http_client
