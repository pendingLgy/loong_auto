from typing import List, Literal, Any

from pydantic import BaseModel, Field, SecretStr

from loong_contracts.response.base import BigIntId


class MessageRequest(BaseModel):
    model: str | None = None
    id: BigIntId | None = None
    created: int | None = None
    role: Literal["system", "user", "assistant", "tool"] = "assistant"
    raw: dict[str, Any] | None = None
    finish_reason: str | None = None
    status: str = "start"
    input_tokens: int | None = 0
    output_tokens: int | None = 0
    total_tokens: int | None = 0
    content: str = ""
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    tool_call_id: str | None = None


class LLMParamRequest(BaseModel):
    provider: str = Field(default="openai", description="模型供应商")
    model: str = Field(min_length=1, description="模型名称")
    temperature: float | None = Field(default=1, description="默认温度")
    api_key: SecretStr | None = Field(default=None, repr=False, description="本次模型调用使用的 API 密钥")

class ToolDefinitionRequest(BaseModel):
    name: str
    description: str = ""
    parameters: dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})
    location: Literal["local", "remote"] = Field(description="local 由当前执行节点处理，remote 返回调用方异步执行")

class AddMessageRequest(BaseModel):
    tenant_id: BigIntId
    user_id: BigIntId
    session_id: str
    session_title: str
    llm: LLMParamRequest
    tools: List[ToolDefinitionRequest]
    messages: List[MessageRequest]




