"""HTTPX 云端 SDK：按调用传入令牌，禁止自动重试。"""
import json
from contextlib import asynccontextmanager
from urllib.parse import quote
from typing import TypeVar

import httpx
from pydantic import BaseModel, SecretStr, TypeAdapter
from loong_contracts.request.login import LoginRequest, RegisterRequest, RefreshTokenRequest
from loong_contracts.request.message import AddMessageRequest
from loong_contracts.response.base import BaseResponse, BasePageResponse
from loong_contracts.response.login import LoginResponse, UserInfoResponse
from loong_contracts.response.event import ChatEventResponse, SSEEvent

T = TypeVar("T")


class CloudAPIError(Exception):
    def __init__(self, code: int, request_id: str | None = None):
        self.code, self.request_id = code, request_id
        super().__init__(f"Cloud API failed: code={code}, request_id={request_id}")


def _wire(value):
    # 只在发送边界展开 SecretStr，不改变全局序列化规则。
    if isinstance(value, SecretStr):
        return value.get_secret_value()
    if isinstance(value, BaseModel):
        return {name: _wire(getattr(value, name)) for name in type(value).model_fields}
    if isinstance(value, dict):
        return {key: _wire(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_wire(item) for item in value]
    return value


def _segment(value: str) -> str:
    if not value or value in {".", ".."}:
        raise ValueError("路径标识不能为空或为相对路径")
    return quote(value, safe="")


class CloudClient:
    def __init__(self, client: httpx.AsyncClient):
        """仅封装接口，客户端配置及生命周期由调用方负责。"""
        self.http = client
        self.auth = AuthAPI(self)
        self.messages = MessagesAPI(self)
        self.events = EventsAPI(self)

    def build_request(self, method, path, **kwargs):
        return self.http.build_request(method, path, **kwargs)

    async def send(self, request, *, stream=False):
        """供透明网关使用，保留原始响应及 HTTP 状态，不做业务异常转换。"""
        return await self.http.send(request, stream=stream)

    async def request(self, method: str, path: str, response_type: type[T], *, body=None,
                      params=None) -> T:
        request = self.build_request(method, path,
                                     json=_wire(body) if body is not None else None, params=params)
        response = await self.send(request)
        response.raise_for_status()
        data = response.json()
        if data.get("code") != 200:
            raise CloudAPIError(data.get("code", 500), data.get("request_id"))
        return TypeAdapter(response_type).validate_python(data)

    @asynccontextmanager
    async def stream(self, method: str, path: str, *, body=None):
        request = self.build_request(method, path, headers={"Accept": "text/event-stream"}, json=_wire(body) if body else None)
        response = await self.send(request, stream=True)
        try:
            response.raise_for_status()
            if not response.headers.get("content-type", "").startswith("text/event-stream"):
                raise ValueError("云端未返回 SSE 响应")
            yield _events(response)
        finally:
            await response.aclose()


async def _events(response):
    event, data, event_id = "message", [], None
    async for line in response.aiter_lines():
        if not line:
            if data:
                yield SSEEvent(event=event, data="\n".join(data), id=event_id)
            event, data = "message", []
        elif not line.startswith(":"):
            key, _, value = line.partition(":")
            value = value[1:] if value.startswith(" ") else value
            if key == "event":
                event = value
            elif key == "data":
                data.append(value)
            elif key == "id" and "\0" not in value:
                event_id = value


class AuthAPI:
    def __init__(self, client):
        self.client = client

    async def login(self, body: LoginRequest):
        return await self.client.request("POST", "/api/auth/login", BaseResponse[LoginResponse], body=body)

    async def register(self, body: RegisterRequest):
        return await self.client.request("POST", "/api/auth/register", BaseResponse[UserInfoResponse], body=body)

    async def refresh_token(self, body: RefreshTokenRequest):
        return await self.client.request("POST", "/api/auth/refresh_token", BaseResponse[LoginResponse], body=body)

    async def me(self):
        return await self.client.request("GET", "/api/auth/me", BaseResponse[UserInfoResponse])

    async def logout(self):
        return await self.client.request("POST", "/api/auth/logout", BaseResponse[None])


class MessagesAPI:
    def __init__(self, client):
        self.client = client

    async def complete(self, session_id: str, body: AddMessageRequest):
        return await self.client.request("POST", f"/api/messages/chat/{_segment(session_id)}/complete",
                                         BaseResponse[ChatEventResponse], body=body)

    def stream(self, session_id: str, body: AddMessageRequest):
        return self.client.stream("POST", f"/api/messages/chat/{_segment(session_id)}/sse", body=body)

    async def list_sessions(self, *, session_title: str = "", page=1, page_size=20):
        return await self.client.request("GET", "/api/messages/sessions", BasePageResponse[list[dict]],
            params={"session_title":session_title,"page":page,"page_size":page_size})

    async def list_messages(self, session_id: str, *, page=1, page_size=20):
        return await self.client.request("GET", f"/api/messages/sessions/{_segment(session_id)}/messages",
            BasePageResponse[list[dict]], params={"page":page,"page_size":page_size})


class EventsAPI:
    def __init__(self, client):
        self.client = client

    def subscribe(self, client_id: str):
        return self.client.stream("GET", f"/api/events/chat/{_segment(client_id)}/sse")

    async def submit(self, client_id: str, body: AddMessageRequest):
        return await self.client.request("POST", f"/api/events/chat/{_segment(client_id)}/messages",
                                         BaseResponse[None], body=body)
