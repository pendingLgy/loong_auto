import unittest
from datetime import datetime, timezone

from starlette.requests import Request

from loong_cloud.common.response import Response


class ResponseTests(unittest.TestCase):
    def setUp(self):
        self.date = datetime.now(timezone.utc)
        self.request = Request({"type": "http", "state": {
            "request_id": "test-request", "request_date": self.date,
        }})

    def test_ok(self):
        body = Response.ok(self.request, {"value": 1})
        self.assertEqual(body.code, 0)
        self.assertEqual(body.msg, "success")
        self.assertEqual(body.data, {"value": 1})
        self.assertEqual(body.request_id, "test-request")
        self.assertEqual(body.request_date, self.date)

    def test_fail(self):
        body = Response.fail(self.request, code=400, msg="参数错误")
        self.assertEqual(body.code, 400)
        self.assertEqual(body.msg, "参数错误")
        self.assertIsNone(body.data)
        self.assertEqual(body.request_id, "test-request")
        with self.assertRaises(ValueError):
            Response.fail(self.request, code=0)
