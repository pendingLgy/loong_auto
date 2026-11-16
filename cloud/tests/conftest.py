"""本地接口测试公共配置；不污染进程环境变量。"""
import os
from pathlib import Path
from datetime import datetime
from typing import Callable, Any

import httpx

import pytest
from dotenv import dotenv_values, set_key
from httpx import AsyncClient

from loong_contracts.request.login import LoginRequest

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

