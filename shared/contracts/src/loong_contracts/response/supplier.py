from pydantic import BaseModel, Field


class SupplierModelResponse(BaseModel):
    """供应商目录中的模型条目。"""

    view: bool = Field(default=False, description="是否返回给客户端")
    enable: bool = Field(default=True, description="是否启用")
    reasoning_effort: list[str] = Field(default_factory=list, description="支持的推理强度")


class SupplierProviderResponse(BaseModel):
    """供应商连接信息与模型目录。"""

    base_url: str
    timeout: float
    popular: bool = Field(default=False, description="热门供应商")
    adapter: str
    models: dict[str, SupplierModelResponse] = Field(default_factory=dict)


class SupplierResponse(BaseModel):
    """供应商目录响应。"""

    providers: dict[str, SupplierProviderResponse] = Field(default_factory=dict)
