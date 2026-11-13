"""供应商无关的模型调用数据。"""

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


ToolLocation = Literal["local", "remote"]


class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any]
    location: ToolLocation = Field(description="来自已注册工具定义的执行位置，不由模型决定")


class Message(BaseModel):
    model: str | None = Field(default=None, description="LLM model")
    role: Literal["system", "user", "assistant", "tool"]
    raw: dict[str, Any] | None = Field(default=None, description="LLM 原始响应")
    status: str | None = Field(default=None, description="LLM 结束原因")
    type: Literal["text", "tool_calls"] = Field(default="text", description="消息内容类型")
    input_tokens: int = Field(default=0, description="输入 Token 用量")
    output_tokens: int = Field(default=0, description="输出 Token 用量")
    total_tokens: int = Field(default=0, description="总 Token 用量")
    content: str = ""
    tool_calls: list[ToolCall] = Field(default_factory=list)
    tool_call_id: str | None = None


class ToolDefinition(BaseModel):
    name: str
    description: str = ""
    parameters: dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})
    location: ToolLocation = Field(description="local 由当前执行节点处理，remote 返回调用方异步执行")


class ModelRequest(BaseModel):
    messages: list[Message] = Field(min_length=1)
    tools: list[ToolDefinition] = Field(default_factory=list)
    max_tokens: int = Field(default=4096, gt=0)
    temperature: float | None = Field(default=None, ge=0, le=2)

    @model_validator(mode="after")
    def unique_tool_names(self):
        names = [tool.name for tool in self.tools]
        if len(names) != len(set(names)):
            raise ValueError("本地与远程工具名称必须全局唯一")
        return self


class ModelResponse(BaseModel):
    message: Message


class ModelStreamEvent(BaseModel):
    type: Literal["text_delta", "tool_call", "done"]
    text: str = ""
    tool_call: ToolCall | None = None
    response: ModelResponse | None = None

    def to_sse(self) -> str:
        """可直接交给 StreamingResponse 的 SSE 帧。"""
        return f"event: {self.type}\ndata: {self.model_dump_json()}\n\n"
