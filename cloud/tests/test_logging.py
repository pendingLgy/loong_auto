import unittest
import asyncio

from loguru import logger

from loong_cloud.core.logging import log_exception
from loong_cloud.middleware.request_context import RequestContextMiddleware


class LoggingTests(unittest.TestCase):
    def test_info_and_warning_include_request_context(self):
        records = []
        sink = logger.add(lambda message: records.append(message.record))

        async def endpoint(scope, receive, send):
            logger.info("普通信息")
            logger.warning("警告信息")
            for record in records:
                self.assertEqual(record["extra"]["request_id"], scope["state"]["request_id"])
                self.assertEqual(record["extra"]["request_date"],
                                 scope["state"]["request_date"].isoformat())

        try:
            asyncio.run(RequestContextMiddleware(endpoint)({"type": "http"}, None, None))
        finally:
            logger.remove(sink)
        self.assertEqual([record["level"].name for record in records], ["INFO", "WARNING"])

    def test_request_context_is_isolated_and_cleared(self):
        records = []
        sink = logger.add(lambda message: records.append(dict(message.record["extra"])))

        async def endpoint(scope, receive, send):
            await asyncio.sleep(0)
            logger.info("请求日志")
            self.assertEqual(records[-1]["request_id"], scope["state"]["request_id"])
            self.assertEqual(records[-1]["request_date"], scope["state"]["request_date"].isoformat())

        async def run():
            middleware = RequestContextMiddleware(endpoint)
            await asyncio.gather(middleware({"type": "http"}, None, None),
                                 middleware({"type": "http"}, None, None))
            logger.info("请求外日志")

        try:
            asyncio.run(run())
        finally:
            logger.remove(sink)
        self.assertNotEqual(records[0]["request_id"], records[1]["request_id"])
        self.assertNotIn("request_id", records[2])

    def test_stack_and_context_without_sensitive_exception_content(self):
        records = []
        sink = logger.add(lambda message: records.append(str(message)), format="{message} {extra}")
        try:
            try:
                raise ValueError("secret-api-key")
            except ValueError as exc:
                log_exception(exc, "测试异常", request_id="request-test")
        finally:
            logger.remove(sink)
        output = "".join(records)
        self.assertIn("Traceback", output)
        self.assertIn("test_stack_and_context", output)
        self.assertIn("ValueError", output)
        self.assertIn("request-test", output)
        self.assertNotIn("secret-api-key", output)
