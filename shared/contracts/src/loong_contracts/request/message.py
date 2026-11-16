from typing import List

from pydantic import BaseModel, Field, SecretStr

from loong_contracts.agent.models import ToolDefinition, Message
from loong_contracts.response.base import BigIntId


class LLMParamRequest(BaseModel):
    provider: str = Field(default="openai", description="模型供应商")
    model: str = Field(min_length=1, description="模型名称")
    temperature: float | None = Field(default=1, description="默认温度")
    api_key: SecretStr | None = Field(default=None, repr=False, description="本次模型调用使用的 API 密钥")


class AddMessageRequest(BaseModel):
    tenant_id: BigIntId
    user_id: BigIntId
    session_id: str
    session_title: str
    llm: LLMParamRequest
    tools: List[ToolDefinition]
    messages: List[Message]
