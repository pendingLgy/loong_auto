"""云端服务启动入口，不提供用户交互 CLI。"""
from dataclasses import dataclass

import uvicorn

from loong_cloud.core.logging import log_exception


@dataclass(frozen=True)
class CloudApplication:
    host: str = "127.0.0.1"
    port: int = 9527

    def run(self) -> None:
        from loong_cloud.app import create_app

        uvicorn.run(create_app(), host=self.host, port=self.port, workers=1)


def main() -> None:
    try:
        CloudApplication(host="127.0.0.1",port=9527).run()
    except Exception as exc:
        log_exception(exc, "云端服务启动或运行失败")
        raise SystemExit(1) from None
