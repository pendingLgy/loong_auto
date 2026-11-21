"""本地服务启动类。"""
import uvicorn

from loong_local.app import create_app


class LocalApplication:
    host: str = "127.0.0.1"
    port: int = 9528

    def run(self) -> None:
        uvicorn.run(create_app(), host=self.host, port=self.port, workers=1)


def main() -> None:
    LocalApplication().run()
