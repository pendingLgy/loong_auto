import unittest

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from loong_cloud.identity import Device, TokenRegistry
from loong_cloud.middleware import AuthenticationMiddleware, RequestContextMiddleware


class AuthenticationTests(unittest.TestCase):
    def test_authentication_and_exact_public_paths(self):
        app = FastAPI()
        app.add_middleware(AuthenticationMiddleware,
                           registry=TokenRegistry({"secret": Device("user", "device")}),
                           public_paths=["/public"])
        app.add_middleware(RequestContextMiddleware)

        @app.get("/public")
        async def public():
            return {"ok": True}

        @app.get("/private")
        async def private(request: Request):
            return {"user_id": request.state.identity.user_id}

        with TestClient(app) as client:
            self.assertEqual(client.get("/public").status_code, 200)
            for headers in ({}, {"Authorization": "Bearer wrong"}, {"Authorization": "Basic secret"}):
                response = client.get("/private", headers=headers)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json()["request_id"], response.headers["X-Request-ID"])
                self.assertEqual(response.json()["code"], 401)
                self.assertIsNone(response.json()["data"])
            self.assertEqual(client.get("/public/child").status_code, 401)
            response = client.get("/private", headers={"Authorization": "Bearer secret"})
            self.assertEqual(response.json(), {"user_id": "user"})
