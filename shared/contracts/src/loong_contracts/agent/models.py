"""供应商无关的模型调用数据。"""

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator, ConfigDict

from loong_contracts.common.llm_message_constant import GlobalMessageStatus, GlobalMessageRole

ToolLocation = Literal["local", "remote"]


class ToolCall(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    arguments: dict[str, Any]
    location: ToolLocation = Field(description="来自已注册工具定义的执行位置，不由模型决定")


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str | None = Field(default=None, description="LLM model")
    id: str | None = Field(default=None, description="message id")
    created: int | None = Field(default=None, description="创建时间")
    role: GlobalMessageRole = Field(default=GlobalMessageRole.ASSISTANT, description="创建时间")
    raw: dict[str, Any] | None = Field(default=None, description="LLM 原始响应")
    finish_reason: str | None = Field(default=None, description="LLM 结束原因")
    status: GlobalMessageStatus = Field(default=GlobalMessageStatus.START, description="消息内容类型")
    input_tokens: int | None = Field(default=0, description="输入 Token 用量")
    output_tokens: int | None = Field(default=0, description="输出 Token 用量")
    total_tokens: int | None = Field(default=0, description="总 Token 用量")
    content: str = ""
    tool_calls: list[ToolCall] | None = Field(default_factory=list)
    tool_call_id: str | None = None


class ToolDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str = ""
    parameters: dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})
    location: ToolLocation = Field(description="local 由当前执行节点处理，remote 返回调用方异步执行")


class ModelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[Message] = Field(min_length=1)
    tools: list[ToolDefinition] = Field(default_factory=list)
    max_tokens: int = Field(default=4096, gt=0)
    temperature: float | None = Field(default=None, ge=0, le=2)

    @model_validator(mode="after")
    def unique_tool_names(self):
        tools = self.tools or []
        names = [tool.name for tool in tools]
        if len(names) != len(set(names)):
            raise ValueError("本地与远程工具名称必须全局唯一")
        return self


class LoopEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_id: str | None = Field(default=None, description="client id")
    error: bool = Field(default=False, description="错误标识")
    summary: bool = Field(default=False, description="汇总消息标识")
    session_id: str | None = Field(default=None, description="session_id")
    messages: list[Message] | None = Field(default=None)
    tool_call_messages: list[Message] | None = Field(default=None)
    tool_calls: list[ToolCall] | None = Field(default=None)
    remote_tool_calls: list[ToolCall] | None = Field(default=None)
    last_message_event: GlobalMessageStatus = Field(default=GlobalMessageStatus.START, description="消息内容类型")
    time: str | None = Field(default=None, description="isoformat 时间")

    def to_sse(self) -> str:
        return f"event: {self.last_message_event.value}\ndata: {self.model_dump_json(exclude_none=True)}\n\n"
