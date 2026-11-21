"""登录 / 注册接口集成测试：执行前必须单独启动 cloud 服务。

运行：python -m pytest cloud/tests/test_login_api.py -v -s
测试会创建唯一命名的测试账号并保留登录日志。
"""
from uuid import uuid4

import httpx
import pytest
from loong_cloud_client import CloudClient
from loong_contracts.request.login import LoginRequest, RefreshTokenRequest, RegisterRequest
from loong_contracts.response.login import LoginResponse, UserInfoResponse


def _new_client(settings) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings("MESSAGE_API_BASE_URL", "http://127.0.0.1:9527"),
        timeout=30,
    )


async def test_register_login_me_logout(settings):
    username = "cloud_login_" + uuid4().hex
    password = uuid4().hex

    async with _new_client(settings) as http:
        cloud = CloudClient(http)

        registered = await cloud.auth.register(
            RegisterRequest(username=username, password=password, name="登录接口测试")
        )
        assert registered.code == 200
        assert isinstance(registered.data, UserInfoResponse)
        assert registered.data.username == username

        login_body = LoginRequest(username=username, password=password, platform="web")
        logged_in = await cloud.auth.login(login_body)
        assert logged_in.code == 200
        assert isinstance(logged_in.data, LoginResponse)
        assert logged_in.data.access_token
        assert logged_in.data.refresh_token
        assert logged_in.data.expires_in > 0

        cloud.build_token(logged_in.data.access_token)
        current = await cloud.auth.me()
        assert isinstance(current.data, UserInfoResponse)
        assert current.data.id == registered.data.id
        assert current.data.username == username

        await cloud.auth.logout()

        with pytest.raises(httpx.HTTPStatusError) as error:
            await cloud.auth.me()
        assert error.value.response.status_code == 401


async def test_login_wrong_password(settings):
    username = "cloud_login_" + uuid4().hex
    password = uuid4().hex

    async with _new_client(settings) as http:
        cloud = CloudClient(http)
        await cloud.auth.register(
            RegisterRequest(username=username, password=password, name="密码错误测试")
        )

        with pytest.raises(httpx.HTTPStatusError) as error:
            await cloud.auth.login(
                LoginRequest(username=username, password="wrong-" + uuid4().hex, platform="web")
            )
        assert error.value.response.status_code == 401


async def test_register_duplicate_username(settings):
    username = "cloud_login_" + uuid4().hex
    password = uuid4().hex

    async with _new_client(settings) as http:
        cloud = CloudClient(http)
        first = await cloud.auth.register(
            RegisterRequest(username=username, password=password, name="重复注册测试")
        )
        assert first.code == 200

        with pytest.raises(httpx.HTTPStatusError) as error:
            await cloud.auth.register(
                RegisterRequest(username=username, password=uuid4().hex, name="重复注册测试")
            )
        assert error.value.response.status_code == 409


async def test_me_requires_token(settings):
    async with _new_client(settings) as http:
        cloud = CloudClient(http)
        with pytest.raises(httpx.HTTPStatusError) as error:
            await cloud.auth.me()
        assert error.value.response.status_code == 401


async def test_refresh_access_token(settings):
    username = "cloud_login_" + uuid4().hex
    password = uuid4().hex

    async with _new_client(settings) as http:
        cloud = CloudClient(http)
        await cloud.auth.register(
            RegisterRequest(username=username, password=password, name="刷新令牌测试")
        )
        logged_in = await cloud.auth.login(
            LoginRequest(username=username, password=password, platform="web")
        )
        assert logged_in.data.refresh_token

        refreshed = await cloud.auth.refresh_token(
            RefreshTokenRequest(refresh_token=logged_in.data.refresh_token)
        )
        assert refreshed.code == 200
        assert isinstance(refreshed.data, str)
        assert refreshed.data
        assert refreshed.data != logged_in.data.access_token

        cloud.build_token(refreshed.data)
        current = await cloud.auth.me()
        assert current.data.username == username

        await cloud.auth.logout()


async def test_refresh_token_invalid(settings):
    async with _new_client(settings) as http:
        cloud = CloudClient(http)
        with pytest.raises(httpx.HTTPStatusError) as error:
            await cloud.auth.refresh_token(
                RefreshTokenRequest(refresh_token="invalid-refresh-token")
            )
        assert error.value.response.status_code == 401
