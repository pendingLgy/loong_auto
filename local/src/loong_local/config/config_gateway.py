"""LOCAL_ 环境变量 > 指定 dotenv/YAML > 默认值。"""
import json
import os
from pathlib import Path
from typing import Literal

import yaml
from dotenv import dotenv_values
from pydantic import Field, field_validator, BaseModel, ConfigDict


class GatewayConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    host: Literal["127.0.0.1", "localhost", "::1"] = Field(default="127.0.0.1")
    port: int = Field(default=8765, ge=1, le=65535)
    cloud_url: str = Field(default="http://127.0.0.1:9527")
    workspace: Path = Field(default_factory=Path.cwd)
    log_path: Path = Field(default=Path("local/logs/gateway.log"))
    timeout: float = Field(default=180, gt=0)
    connect_timeout: float = Field(default=10, gt=0)
    sse_read_timeout: float = Field(default=60, gt=0)
    heartbeat_interval: float = Field(default=15, gt=0)
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def origins(cls, value: object) -> object:
        if isinstance(value, str):
            return json.loads(value) if value.startswith("[") else [x.strip() for x in value.split(",") if x.strip()]
        return value

    @classmethod
    def load(cls, path: Path | None = None) -> "GatewayConfig":
        config = cls()
        if path is not None:
            if not path.is_file():
                raise FileNotFoundError(path)
            if path.suffix.lower() in {".yaml", ".yml"}:
                config = cls.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
            elif path.name == ".env" or path.name.startswith(".env."):
                values = dotenv_values(path, interpolate=False, encoding="utf-8")
                for name in cls.model_fields:
                    value = values.get("LOCAL_" + name.upper())
                    if value is not None:
                        setattr(config, name, value)
            else:
                raise ValueError("配置文件必须是 .env / .env.* / .yaml / .yml")
        for name in cls.model_fields:
            value = os.environ.get("LOCAL_" + name.upper())
            if value is not None:
                setattr(config, name, value)
        return config
