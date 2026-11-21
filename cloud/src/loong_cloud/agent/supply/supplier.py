"""解析厂商模型目录（default_models.yaml），供适配器与执行器复用。"""

from pathlib import Path

import yaml
from loguru import logger
from pydantic import BaseModel, Field

from loong_cloud.agent.adapters.connection import ProviderConnection


class SupplierModel(BaseModel):
    """目录中的单个模型条目。

    - view：是否返回给客户端展示；
    - enable：是否启用；禁用后执行器不允许调用。
    """

    view: bool = Field(default=False, description="是否返回给客户端")
    enable: bool = Field(default=True, description="是否启用")
    reasoning_effort: list[str] = Field(default_factory=list, description="支持的推理强度")


class SupplierProvider(ProviderConnection):
    """厂商连接信息与适配器名称。"""

    adapter: str = Field(min_length=1, description="对应适配器名称")
    models: dict[str, SupplierModel] = Field(default_factory=dict, description="厂商模型目录")


class ModelSupplier(BaseModel):
    """厂商模型目录。"""

    providers: dict[str, SupplierProvider] = Field(default_factory=dict)

    def provider(self, name: str) -> SupplierProvider | None:
        """按厂商名称获取目录项。"""
        return self.providers.get(name)

    def visible_models(self, name: str) -> dict[str, SupplierModel]:
        """返回允许给客户端展示的模型（view=True）。"""
        provider = self.provider(name)
        if provider is None:
            return {}
        return {model_name: model for model_name, model in provider.models.items() if model.view}

    def connection(self, name: str) -> ProviderConnection | None:
        """按厂商名称生成仅供适配器使用的连接实例。"""
        provider = self.provider(name)
        if provider is None:
            return None
        return ProviderConnection(base_url=provider.base_url, timeout=provider.timeout)


def _read_supplier(path: str | Path) -> str:
    if path is not None:
        return Path(path).read_text(encoding="utf-8")


def load_supplier(path: str | Path) -> ModelSupplier:
    """从 YAML 文件或包内默认目录加载模型目录。"""
    raw = yaml.safe_load(_read_supplier(path))
    supplier = ModelSupplier.model_validate(raw or {})
    logger.info(f"loading supplier from {path}, data:{supplier.model_dump_json(ensure_ascii=False)}")
    return supplier

