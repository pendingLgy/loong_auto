"""模型选择及生成参数。"""

from pydantic import BaseModel, Field, SecretStr


class ModelConfig(BaseModel):
    provider: str = Field(default="openai", description="模型供应商")
    model: str = Field(min_length=1, description="模型名称")
    temperature: float | None = Field(default=None, ge=0, le=2, description="默认温度")
    api_key: SecretStr | None = Field(default=None, repr=False, description="本次模型调用使用的 API 密钥")
