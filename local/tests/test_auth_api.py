"""AuthAPI 真实集成测试：先启动 cloud 和 local 网关。

配置读取 local/.env.test，同名环境变量优先。LOCAL_API_BASE_URL 默认 http://127.0.0.1:8765。
使用 SDK.auth 经 local 调用 cloud，不使用 mock；会保留唯一测试账号及登录日志。
"""
from uuid import uuid4

import httpx
import pytest
from loong_cloud_client import CloudClient

from loong_contracts.request.login import LoginRequest, RegisterRequest, RefreshTokenRequest
from loong_contracts.response.login import LoginResponse, UserInfoResponse


URL_PREFIX = "api/common"


async def test_auth_register_login_me_refresh_logout(http_client):
    cloud = CloudClient(http_client,prefix=URL_PREFIX)
    """验证完整认证流程以及退出后 access token 被撤销。"""
    username = "local_auth_" + uuid4().hex
    password = uuid4().hex
    register_body = RegisterRequest(username=username, password=password, name="本地认证测试")
    registered = await cloud.auth.register(register_body)
    assert registered.code == 200
    assert isinstance(registered.data, UserInfoResponse)
    assert registered.data.username == username

    login_body = LoginRequest(username=username, password=password, platform="tui")
    logged_in = await cloud.auth.login(login_body)
    assert isinstance(logged_in.data, LoginResponse)
    assert logged_in.data.access_token
    assert logged_in.data.refresh_token
    assert logged_in.data.expires_in > 0
    token = logged_in.data.access_token
    http_client.headers["Authorization"] = f"Bearer {token}"
    try:
        current = await cloud.auth.me()
        assert current.data.id == registered.data.id
        assert current.data.username == username

        refresh_body = RefreshTokenRequest(refresh_token=logged_in.data.refresh_token)
        refreshed = await cloud.auth.refresh_token(refresh_body)
        assert isinstance(refreshed.data, LoginResponse)
        token = refreshed.data.access_token
        http_client.headers["Authorization"] = f"Bearer {token}"
        assert token
        current = await cloud.auth.me()
        assert current.data.id == registered.data.id
    finally:
        await cloud.auth.logout()

    with pytest.raises(httpx.HTTPStatusError) as error:
        await cloud.auth.me()
    assert error.value.response.status_code == 401


async def test_auth_login_wrong_password(http_client):
    cloud = CloudClient(http_client,prefix=URL_PREFIX)
    username = "local_auth_" + uuid4().hex
    register_body = RegisterRequest(username=username, password=uuid4().hex, name="密码错误测试")
    registered = await cloud.auth.register(register_body)
    assert registered.data.username == username
    login_body = LoginRequest(username=username, password="wrong-password-" + uuid4().hex, platform="tui")
    with pytest.raises(httpx.HTTPStatusError) as error:
        await cloud.auth.login(login_body)
    assert error.value.response.status_code == 401


async def test_auth_me_invalid_token(http_client):
    cloud = CloudClient(http_client,prefix=URL_PREFIX)
    http_client.headers["Authorization"] = "Bearer invalid-test-token"
    with pytest.raises(httpx.HTTPStatusError) as error:
        await cloud.auth.me()
    assert error.value.response.status_code == 401


async def test_auth_me_configured_account(client, settings):
    response = await CloudClient(client,prefix=URL_PREFIX).auth.me()
    assert isinstance(response.data, UserInfoResponse)
    if settings("LOCAL_API_USERNAME"):
        assert response.data.username == settings("LOCAL_API_USERNAME")
