"""HTTPX 云端 SDK：按调用传入令牌，禁止自动重试。"""
from typing import TypeVar
from urllib.parse import quote

import httpx
from pydantic import BaseModel, SecretStr, TypeAdapter

from loong_contracts.agent.models import LoopEvent
from loong_contracts.request.login import LoginRequest, RegisterRequest, RefreshTokenRequest
from loong_contracts.request.message import AddMessageRequest
from loong_contracts.response.base import BaseResponse, BasePageResponse
from loong_contracts.response.login import LoginResponse, UserInfoResponse

T = TypeVar("T")


class CloudAPIError(Exception):
    def __init__(self, code: int, request_id: str | None = None):
        self.code, self.request_id = code, request_id
        super().__init__(f"Cloud API failed: code={code}, request_id={request_id}")


def _wire(value):
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
    def __init__(self, client: httpx.AsyncClient, prefix:str = ""):
        self.http = client
        self.auth = AuthAPI(self, prefix)
        self.messages = MessagesAPI(self, prefix)
        self.events = EventsAPI(self, prefix)
        self.prefix = prefix

    def build_token(self, token: str):
        self.http.headers["Authorization"] = f"Bearer {token}"

    def build_request(self, method, path, **kwargs):
        return self.http.build_request(method, path, **kwargs)

    async def send(self, request, *, stream=False):
        return await self.http.send(request, stream=stream)

    async def request(self, method: str, path: str, response_type: type[T], *, body=None,
                      params=None, headers: httpx.Headers | dict[str, str] | list[tuple[str, str]] | None = None) -> T:
        request = self.build_request(method, path,
                                     json=_wire(body) if body is not None else None, params=params, headers=headers)
        response = await self.send(request)
        response.raise_for_status()
        data = response.json()
        if data.get("code") != 200:
            raise CloudAPIError(data.get("code", 500), data.get("request_id"))
        return TypeAdapter(response_type).validate_python(data)

    async def stream_response(self, method: str, path: str, *, body=None) -> httpx.Response:
        """
        发送 SSE 流式请求，返回打开的 httpx.Response 对象。
        【注意】关闭连接的责任完全交由调用方（在消费完流或发生异常后调用 response.aclose()）。
        """
        request = self.build_request(
            method,
            path,
            headers={"Accept": "text/event-stream"},
            json=_wire(body) if body else None
        )
        response = await self.send(request, stream=True)
        try:
            response.raise_for_status()
            if not response.headers.get("content-type", "").startswith("text/event-stream"):
                raise ValueError("云端未返回 SSE 响应")
            return response
        except Exception:
            # 只有在初始化校验（如非200、非SSE头）失败时才在内部安全关闭，防止连接泄漏
            await response.aclose()
            raise


class AuthAPI:
    def __init__(self, client, prefix:str = ""):
        self.client = client
        self.prefix = prefix

    async def login(self, body: LoginRequest):
        return await self.client.request("POST", f"{self.prefix}/api/auth/login", BaseResponse[LoginResponse], body=body)

    async def register(self, body: RegisterRequest):
        return await self.client.request("POST", f"{self.prefix}/api/auth/register", BaseResponse[UserInfoResponse], body=body)

    async def refresh_token(self, body: RefreshTokenRequest):
        return await self.client.request("POST", f"{self.prefix}/api/auth/refresh_token", BaseResponse[LoginResponse], body=body)

    async def me(self):
        return await self.client.request("GET", f"{self.prefix}/api/auth/me", BaseResponse[UserInfoResponse])

    async def logout(self):
        return await self.client.request("POST", f"{self.prefix}/api/auth/logout", BaseResponse[None])


class MessagesAPI:
    def __init__(self, client, prefix:str = ""):
        self.client = client
        self.prefix = prefix

    async def complete(self, session_id: str, body: AddMessageRequest):
        return await self.client.request("POST", f"{self.prefix}/api/messages/chat/{_segment(session_id)}/complete",
                                         BaseResponse[LoopEvent], body=body)

    async def stream(self, session_id: str, body: AddMessageRequest) -> httpx.Response:
        """返回 SSE 响应对象，由调用方管理生命周期"""
        return await self.client.stream_response("POST", f"{self.prefix}/api/messages/chat/{_segment(session_id)}/sse", body=body)

    async def list_sessions(self, *, session_title: str = "", page=1, page_size=20):
        return await self.client.request("GET", f"{self.prefix}/api/messages/sessions", BasePageResponse[list[dict]],
            params={"session_title": session_title, "page": page, "page_size": page_size})

    async def list_messages(self, session_id: str, *, page=1, page_size=20):
        return await self.client.request("GET", f"{self.prefix}/api/messages/sessions/{_segment(session_id)}/messages",
            BasePageResponse[list[dict]], params={"page": page, "page_size": page_size})


class EventsAPI:
    def __init__(self, client, prefix:str = ""):
        self.client = client
        self.prefix = prefix

    async def subscribe(self, client_id: str) -> httpx.Response:
        """返回事件订阅的 SSE 响应对象，由调用方管理生命周期"""
        return await self.client.stream_response("GET", f"{self.prefix}/api/events/chat/{_segment(client_id)}/sse")

    async def submit(self, client_id: str, body: AddMessageRequest, *,
                     headers: httpx.Headers | dict[str, str] | list[tuple[str, str]] | None = None) -> BaseResponse[None]:
        return await self.client.request("POST", f"{self.prefix}/api/events/chat/{_segment(client_id)}/messages",
                                         BaseResponse[None], body=body, headers=headers)