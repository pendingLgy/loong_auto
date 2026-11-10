import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from loong_cloud.api.tasks import router
from loong_cloud.identity import Device, TokenRegistry
from loong_cloud.middleware import AuthenticationMiddleware, RequestContextMiddleware


class TasksDemoTests(unittest.TestCase):
    def test_demo(self):
        app = FastAPI()
        app.include_router(router, prefix="/api")
        app.add_middleware(AuthenticationMiddleware,
                           registry=TokenRegistry({"demo-token": Device("user", "device")}),
                           public_paths=[])
        app.add_middleware(RequestContextMiddleware)
        with TestClient(app) as client:
            self.assertEqual(client.get("/api/tasks/demo").status_code, 401)
            response = client.get("/api/tasks/demo", headers={"Authorization": "Bearer demo-token"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"], {"message": "tasks demo"})
        self.assertEqual(response.json()["request_id"], response.headers["X-Request-ID"])
