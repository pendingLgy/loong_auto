import json
import os
from pathlib import Path
from typing import Any, Literal

from dotenv import dotenv_values
from pydantic import BaseModel, ConfigDict, Field

from .config_db import DatabaseConfig
from .config_gateway import GatewayConfig

ENV_PREFIX = "LOONG_"
ENV_NESTED_DELIMITER = "__"


class GlobalConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(default="INFO", description="日志level")

    enable_security_token: bool = Field(default=False, description="是否开启token校验")
    security_token: str = Field(default="", description="本地网关访问令牌；为空时启动生成随机令牌")

    gateway_config: GatewayConfig = Field(default_factory=GatewayConfig, description="gateway配置")
    db_config: DatabaseConfig = Field(default_factory=DatabaseConfig, description="DB配置")

    @classmethod
    def load(cls, path: str | Path) -> "GlobalConfig":
        """按文件名加载 .env 或 YAML，环境变量覆盖文件中的同名配置。"""
        return load_global_config(path)


def _decode_value(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            pass
    return value


def _merge_config(target: dict[str, Any], source: dict[str, Any]) -> None:
    for key, value in source.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _merge_config(target[key], value)
        else:
            target[key] = value


def _apply_prefixed_values(data: dict[str, Any], values: dict[str, Any]) -> None:
    # 先处理整个对象，再处理嵌套键，保证嵌套键覆盖对象内的同名字段。
    for key in sorted(values, key=lambda name: (name.count(ENV_NESTED_DELIMITER), name)):
        if not key.startswith(ENV_PREFIX):
            continue
        parts = key[len(ENV_PREFIX):].lower().split(ENV_NESTED_DELIMITER)
        if any(not part for part in parts):
            raise ValueError("配置环境变量的字段路径不能为空")
        current = data
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            if not isinstance(current[part], dict):
                raise ValueError("配置环境变量的嵌套路径与已有值冲突")
            current = current[part]
        _merge_config(current, {parts[-1]: _decode_value(values[key])})


def load_global_config(path: str | Path) -> GlobalConfig:
    """加载模型结构的 YAML 或 LOONG_ 前缀配置，__ 分隔嵌套字段。

    优先级：进程环境变量 > 文件中的前缀键 > 文件中的模型字段。
    数组和对象使用 JSON 表达，字段类型与未知字段由 Pydantic 校验。
    """
    values = loading_config(path, include_environment=False)
    data = {key: value for key, value in values.items() if not key.startswith(ENV_PREFIX)}
    # dotenv 的配置项必须使用固定前缀；YAML 可以直接使用模型字段结构。
    if Path(path).suffix.lower() not in {".yaml", ".yml"}:
        data = {}
    _apply_prefixed_values(data, values)
    _apply_prefixed_values(data, dict(os.environ))
    return GlobalConfig.model_validate(data)


def loading_config(path: str | Path | None = None, *, include_environment: bool = True) -> dict[str, Any]:
    """无 path 时仅读取环境；显式传入文件必须存在，支持 .env[.*] 和 YAML。"""
    values: dict[str, Any] = {}
    if path is not None:
        file = Path(path)
        if not file.is_file():
            raise FileNotFoundError(f"配置文件不存在：{file}")
        if file.suffix.lower() in {".yaml", ".yml"}:
            import yaml

            with file.open(encoding="utf-8") as stream:
                content = yaml.safe_load(stream)
            if content is not None and (
                    not isinstance(content, dict) or any(not isinstance(key, str) for key in content)
            ):
                raise ValueError("YAML 配置必须为字符串键组成的映射")
            values.update(content or {})
        elif file.name == ".env" or file.name.startswith(".env.") or file.suffix.lower() == ".env":
            values.update({key: value for key, value in dotenv_values(file, interpolate=False).items()
                           if value is not None})
        else:
            raise ValueError("不支持的配置文件格式，仅支持 .env、.yaml、.yml")
    if include_environment:
        values.update(os.environ)
    return values
