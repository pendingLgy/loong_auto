"""HTTPX 云端 SDK：按调用传入令牌，禁止自动重试。"""
from typing import TypeVar
from urllib.parse import quote

import httpx
from loong_contracts.agent.models import LoopEvent
from loong_contracts.request.login import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
)
from loong_contracts.request.message import AddMessageRequest
from loong_contracts.request.session import CreateSessionRequest, UpdateSessionRequest
from loong_contracts.request.working_directory import (
    CreateWorkingDirectoryRequest,
    UpdateWorkingDirectoryRequest,
)
from loong_contracts.response.base import BasePageResponse, BaseResponse
from loong_contracts.response.login import LoginResponse, UserInfoResponse
from loong_contracts.response.message import RawMessageResponse
from loong_contracts.response.session import SessionSimpleResponse
from loong_contracts.response.supplier import SupplierResponse
from loong_contracts.response.workspace import WorkspaceResponse
from pydantic import BaseModel, SecretStr, TypeAdapter

T = TypeVar("T")



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
    def __init__(self, client: httpx.AsyncClient, prefix: str = ""):
        self.http = client
        self.auth = AuthAPI(self, prefix)
        self.messages = MessagesAPI(self, prefix)
        self.events = EventsAPI(self, prefix)
        self.workspaces = WorkspacesAPI(self, prefix)
        self.sessions = SessionsAPI(self, prefix)
        self.supplier = SupplierAPI(self, prefix)
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
    def __init__(self, client, prefix: str = ""):
        self.client:CloudClient = client
        self.prefix = prefix

    async def login(self, body: LoginRequest):
        return await self.client.request("POST", f"{self.prefix}/api/auth/login", BaseResponse[LoginResponse], body=body)

    async def register(self, body: RegisterRequest):
        return await self.client.request("POST", f"{self.prefix}/api/auth/register", BaseResponse[UserInfoResponse], body=body)

    async def refresh_token(self, body: RefreshTokenRequest):
        return await self.client.request("POST", f"{self.prefix}/api/auth/refresh_token", BaseResponse[str], body=body)

    async def me(self):
        return await self.client.request("GET", f"{self.prefix}/api/auth/me", BaseResponse[UserInfoResponse])

    async def logout(self):
        return await self.client.request("POST", f"{self.prefix}/api/auth/logout", BaseResponse[None])


class MessagesAPI:
    def __init__(self, client, prefix: str = ""):
        self.client:CloudClient = client
        self.prefix = prefix

    async def complete(self, client_id: str, workspace_id: int, session_id: str, body: AddMessageRequest):
        """非流式对话：提交消息并同步返回一轮结果。"""
        return await self.client.request(
            "POST",
            f"{self.prefix}/api/messages/chat/{_segment(client_id)}/complete/{_segment(session_id)}",
            BaseResponse[LoopEvent],
            body=body,
        )

    async def list(self, session_id: str, *, page: int = 1, page_size: int = 20) -> BasePageResponse[list[RawMessageResponse]]:
        return await self.client.request(
            "GET",
            f"{self.prefix}/api/messages",
            BasePageResponse[list[RawMessageResponse]],
            params={"session_id": session_id, "page": page, "page_size": page_size},
        )

    async def stream(self, client_id: str, session_id: str, body: AddMessageRequest) -> httpx.Response:
        """返回 SSE 响应对象，由调用方管理生命周期。"""
        return await self.client.stream_response(
            "POST",
            f"{self.prefix}/api/messages/chat/{_segment(client_id)}/sse/{_segment(session_id)}",
            body=body,
        )


class EventsAPI:
    def __init__(self, client: CloudClient, prefix: str = ""):
        self.client:CloudClient = client
        self.prefix = prefix

    async def subscribe(self, client_id: str) -> httpx.Response:
        """返回事件订阅的 SSE 响应对象，由调用方管理生命周期。"""
        return await self.client.stream_response(
            "GET", f"{self.prefix}/api/events/chat/{_segment(client_id)}/sse"
        )

    async def submit(
        self,
        client_id: str,
        session_id: str,
        body: AddMessageRequest,
        *,
        headers: httpx.Headers | dict[str, str] | list[tuple[str, str]] | None = None,
    ) -> BaseResponse[None]:
        """向已订阅的连接提交一轮消息。"""
        return await self.client.request(
            "POST",
            f"{self.prefix}/api/events/chat/{_segment(client_id)}/messages/{_segment(session_id)}",
            BaseResponse[None],
            body=body,
            headers=headers,
        )


class WorkspacesAPI:
    def __init__(self, client, prefix: str = ""):
        self.client:CloudClient = client
        self.prefix = prefix

    async def list(self, *, page: int = 1, page_size: int = 20):
        return await self.client.request(
            "GET",
            f"{self.prefix}/api/workspace",
            BasePageResponse[list[WorkspaceResponse]],
            params={"page": page, "page_size": page_size},
        )

    async def create(self, body: CreateWorkingDirectoryRequest) -> BaseResponse[WorkspaceResponse]:
        return await self.client.request(
            "POST", f"{self.prefix}/api/workspace", BaseResponse[WorkspaceResponse], body=body
        )

    async def get(self, workspace_id: int):
        return await self.client.request(
            "GET", f"{self.prefix}/api/workspace/{workspace_id}", BaseResponse[WorkspaceResponse]
        )

    async def update(self, workspace_id: int,
                     body: UpdateWorkingDirectoryRequest) -> BaseResponse[WorkspaceResponse]:
        return await self.client.request(
            "PUT", f"{self.prefix}/api/workspace/{workspace_id}", BaseResponse[WorkspaceResponse], body=body
        )

    async def delete(self, workspace_id: int):
        return await self.client.request(
            "DELETE", f"{self.prefix}/api/workspace/{workspace_id}", BaseResponse[dict]
        )


class SessionsAPI:
    def __init__(self, client, prefix: str = ""):
        self.client:CloudClient = client
        self.prefix = prefix

    async def list(self, *, workspace_id: int, page: int = 1, page_size: int = 20):
        params = {"page": page, "page_size": page_size}
        if workspace_id is not None:
            params["workspace_id"] = workspace_id
        return await self.client.request(
            "GET",
            f"{self.prefix}/api/sessions",
            BasePageResponse[list[SessionSimpleResponse]],
            params=params,
        )

    async def create(self, body: CreateSessionRequest):
        return await self.client.request(
            "POST", f"{self.prefix}/api/sessions", BaseResponse[SessionSimpleResponse], body=body
        )

    async def get(self, session_id: str, workspace_id: int):
        request_params = {"workspace_id": workspace_id}

        return await self.client.request(
            "GET",
            f"{self.prefix}/api/sessions/{_segment(session_id)}",
            BaseResponse[SessionSimpleResponse],
            params=request_params,
        )

    async def update(self, session_id: str, body: UpdateSessionRequest):
        return await self.client.request(
            "PUT",
            f"{self.prefix}/api/sessions/{_segment(session_id)}",
            BaseResponse[SessionSimpleResponse],
            body=body,
        )


class SupplierAPI:
    def __init__(self, client, prefix: str = ""):
        self.client:CloudClient = client
        self.prefix = prefix

    async def get(self) -> BaseResponse[SupplierResponse]:
        """获取按 view 过滤后的模型供应商目录。"""
        return await self.client.request(
            "GET", f"{self.prefix}/api/supplier", BaseResponse[SupplierResponse]
        )
