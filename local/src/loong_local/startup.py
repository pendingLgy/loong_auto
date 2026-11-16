"""本地网关启动入口。"""

import argparse
from pathlib import Path
from dataclasses import dataclass

import uvicorn

from .app import create_app
from .gateway.config import GatewayConfig


@dataclass(frozen=True)
class LocalApplication:
    host: str = "127.0.0.1"
    port: int = 8765
    config: GatewayConfig | None = None

    def run(self) -> None:
        if self.host not in ("127.0.0.1", "::1"):
            raise ValueError("本地网关仅允许绑定 loopback 地址")
        uvicorn.run(create_app(self.config),
                    host=self.host, port=self.port, workers=1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Loong 本地网关")
    parser.add_argument("--path", type=Path, help="指定 .env 或 YAML 配置文件")
    args = parser.parse_args()
    config = GatewayConfig.load(args.path)
    LocalApplication(host=config.host, port=config.port, config=config).run()
