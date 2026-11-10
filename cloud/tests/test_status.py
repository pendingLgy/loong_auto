"""服务状态接口的最小测试，无需启动真实服务或配置模型密钥。"""

import unittest
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.testclient import TestClient

from loong_cloud.api.status import mark_started, router
from loong_cloud.middleware import RequestContextMiddleware


class StatusApiTests(unittest.TestCase):
    def test_get_service_status(self):
        @asynccontextmanager
        async def lifespan(app: FastAPI):
            mark_started(app)
            yield

        app = FastAPI(version="0.1.0", lifespan=lifespan)
        app.add_middleware(RequestContextMiddleware)
        app.include_router(router, prefix="/api")

        with TestClient(app) as client:
            response = client.get("/api/status")
            second_response = client.get("/api/status")

        self.assertEqual(response.status_code, 200)
        envelope = response.json()
        self.assertEqual(set(envelope), {"code", "msg", "data", "request_date", "request_id"})
        self.assertEqual(envelope["code"], 0)
        self.assertEqual(envelope["request_id"], response.headers["X-Request-ID"])
        self.assertEqual(envelope["request_id"], response.headers["request_id"])
        self.assertEqual(datetime.fromisoformat(envelope["request_date"]),
                         datetime.fromisoformat(response.headers["request_date"]))
        self.assertEqual(datetime.fromisoformat(envelope["request_date"]),
                         datetime.fromisoformat(response.headers["X-Request-Date"]))
        self.assertNotEqual(envelope["request_id"], second_response.json()["request_id"])
        body = envelope["data"]
        self.assertEqual(body["service"], "loong-cloud")
        self.assertEqual(body["status"], "running")
        self.assertEqual(body["version"], "0.1.0")
        self.assertGreaterEqual(body["uptime_seconds"], 0)


if __name__ == "__main__":
    unittest.main()
