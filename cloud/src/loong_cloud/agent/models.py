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
    id: str | None = Field(default=None, description="message id")
    created: int | None = Field(default=None, description="创建时间")
    role: Literal["system", "user", "assistant", "tool"] = Field(default="assistant", description="创建时间")
    raw: dict[str, Any] | None = Field(default=None, description="LLM 原始响应")
    finish_reason: str | None = Field(default=None, description="LLM 结束原因")
    status: Literal["start", "running","stop"] = Field(default="start", description="消息内容类型")
    input_tokens: int | None = Field(default=0, description="输入 Token 用量")
    output_tokens: int | None = Field(default=0, description="输出 Token 用量")
    total_tokens: int | None = Field(default=0, description="总 Token 用量")
    content: str = ""
    tool_calls: list[ToolCall] | None = Field(default_factory=list)
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


class LoopEvent(BaseModel):
    type: Literal["text", "text_delta", "tool_calls", "completed"]
    status: str | None = Field(default=None, description="LLM 返回的结束原因 finish_reason")
    raw: dict[str, Any] | None = Field(default=None, description="本轮最后一次 LLM 调用的原始响应")
    content: str = Field(default="")
    tool_calls: list[ToolCall] = Field(default_factory=list)
    messages: list[Message] = Field(default_factory=list)

    def to_sse(self) -> str:
        return f"event: {self.type}\ndata: {self.model_dump_json()}\n\n"
