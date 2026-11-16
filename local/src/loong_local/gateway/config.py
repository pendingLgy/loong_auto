"""本地网关环境配置。"""
import json
import os
from pathlib import Path
from dotenv import dotenv_values
import yaml
from typing import Literal
from pydantic import BaseModel, Field, HttpUrl


class GatewayConfig(BaseModel):
    host: Literal["127.0.0.1", "::1"] = Field(default="127.0.0.1")
    port: int = Field(default=8765, ge=1, le=65535)
    cloud_url: HttpUrl = Field(default="http://127.0.0.1:9527")
    timeout: float = Field(default=180, gt=0)
    connect_timeout: float = Field(default=10, gt=0)
    sse_read_timeout: float = Field(default=60, gt=0)
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])
    log_path: Path = Field(default=Path("local/logs/gateway.log"))

    @classmethod
    def load(cls, path: str | Path | None = None) -> "GatewayConfig":
        """加载 .env/YAML；LOCAL_ 环境变量覆盖文件，未指定文件时读取环境。"""
        values = {}
        prefixed = {}
        if path is not None:
            file = Path(path).expanduser()
            if not file.is_file():
                raise FileNotFoundError(f"配置文件不存在：{file}")
            if file.suffix.lower() in {".yaml", ".yml"}:
                content = yaml.safe_load(file.read_text(encoding="utf-8"))
                if content is not None and not isinstance(content, dict):
                    raise ValueError("YAML 配置必须为映射")
                values.update(content or {})
            elif file.name == ".env" or file.name.startswith(".env.") or file.suffix.lower() == ".env":
                prefixed.update(dotenv_values(file, interpolate=False, encoding="utf-8"))
            else:
                raise ValueError("仅支持 .env、.yaml、.yml 配置文件")
        prefixed.update(os.environ)
        for name in cls.model_fields:
            value = prefixed.get(f"LOCAL_{name.upper()}")
            if value is not None:
                if name == "allowed_origins":
                    value = json.loads(value) if value.lstrip().startswith("[") else [
                        item.strip() for item in value.split(",") if item.strip()
                    ]
                values[name] = value
        return cls.model_validate(values)
