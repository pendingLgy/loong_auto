"""独立于云端实现的对话响应与 SSE 契约。"""
from typing import Any, Literal
from pydantic import BaseModel, Field


class ToolCallResponse(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any]
    location: Literal["local", "remote"]


class MessageResponse(BaseModel):
    id: str | None = None
    model: str | None = None
    created: int | None = None
    role: str = "assistant"
    content: str = ""
    status: str = "start"
    finish_reason: str | None = None
    raw: dict[str, Any] | None = None
    input_tokens: int | None = 0
    output_tokens: int | None = 0
    total_tokens: int | None = 0
    tool_calls: list[ToolCallResponse] | None = Field(default_factory=list)
    tool_call_id: str | None = None


class ChatEventResponse(BaseModel):
    error: bool = False
    summary: bool = False
    session_id: str | None = None
    messages: list[MessageResponse] = Field(default_factory=list)
    tool_call_messages: list[MessageResponse] = Field(default_factory=list)
    tool_calls: list[ToolCallResponse] = Field(default_factory=list)
    remote_tool_calls: list[ToolCallResponse] = Field(default_factory=list)


class ConnectionEventResponse(BaseModel):
    client_id: str
    time: str


class SSEEvent(BaseModel):
    event: str
    data: str
    id: str | None = None

    def payload(self) -> ChatEventResponse | ConnectionEventResponse:
        model = ConnectionEventResponse if self.event in {"connected", "heartbeat"} else ChatEventResponse
        return model.model_validate_json(self.data)
