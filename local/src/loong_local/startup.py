"""本地网关启动入口；当前仅实现健康检查。"""

import os
from dataclasses import dataclass

import uvicorn


@dataclass(frozen=True)
class LocalApplication:
    host: str = "127.0.0.1"
    port: int = 8765

    def run(self) -> None:
        if self.host not in ("127.0.0.1", "::1"):
            raise ValueError("本地网关仅允许绑定 loopback 地址")
        uvicorn.run("loong_local.gateway.app:create_app", factory=True,
                    host=self.host, port=self.port, workers=1)


def main() -> None:
    LocalApplication(port=int(os.getenv("LOCAL_PORT", "8765"))).run()
