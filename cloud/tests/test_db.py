import unittest
import importlib.util

from sqlalchemy import text

from loong_cloud.db import DatabaseConfig, DatabaseProxy
from loong_cloud.config.config_db import SqliteConfig, MysqlConfig, PgSqlConfig, PoolConfig
from sqlalchemy.pool import QueuePool, AsyncAdaptedQueuePool, StaticPool


class DatabaseTests(unittest.TestCase):
    def test_connection_fields_and_url_priority(self):
        self.assertEqual(SqliteConfig(database=":memory:").sqlalchemy_url().database, ":memory:")
        for config in (MysqlConfig(host="db", port=3307, username="user", password="p@:/#",
                                   database="demo", charset="utf8mb4"),
                       PgSqlConfig(host="db", port=5433, username="user", password="p@:/#",
                                   database="demo")):
            for asynchronous in (False, True):
                url = config.sqlalchemy_url(asynchronous=asynchronous)
                self.assertEqual((url.host, url.port, url.username, url.password, url.database),
                                 (config.host, config.port, "user", "p@:/#", "demo"))
            self.assertNotIn("p@:/#", repr(config))
        config = MysqlConfig(url="mysql://other/explicit", host="ignored", database="ignored")
        self.assertEqual(config.sqlalchemy_url().database, "explicit")
        self.assertEqual(config.sqlalchemy_url().host, "other")


    def test_typed_config_and_pool(self):
        for config, backend in [(SqliteConfig(), "sqlite"), (MysqlConfig(), "mysql"),
                                (PgSqlConfig(), "postgresql")]:
            self.assertEqual(config.sqlalchemy_url().get_backend_name(), backend)
            self.assertIs(config.engine_options()["poolclass"], QueuePool)
            self.assertIs(config.engine_options(asynchronous=True)["poolclass"], AsyncAdaptedQueuePool)
        self.assertIs(SqliteConfig("sqlite:///:memory:").engine_options()["poolclass"], StaticPool)
        with self.assertRaises(ValueError):
            PoolConfig(size=0)
        with self.assertRaises(ValueError):
            MysqlConfig("sqlite:///x.db").sqlalchemy_url()

    def test_manual_transaction(self):
        proxy = DatabaseProxy(DatabaseConfig("sqlite:///:memory:"))
        try:
            with proxy.session() as session:
                session.execute(text("CREATE TABLE demo (value INTEGER)"))
            with proxy.session(auto_commit=False) as session:
                session.execute(text("INSERT INTO demo VALUES (1)"))
                session.commit()
                session.execute(text("INSERT INTO demo VALUES (2)"))
                session.rollback()
                session.execute(text("INSERT INTO demo VALUES (3)"))
            with proxy.session() as session:
                self.assertEqual(session.execute(text("SELECT value FROM demo")).scalars().all(), [1])
        finally:
            proxy.dispose()

    def test_transaction_commit_rollback_and_close(self):
        proxy = DatabaseProxy(DatabaseConfig("sqlite:///:memory:"))
        try:
            with proxy.session() as session:
                session.execute(text("CREATE TABLE demo (value INTEGER)"))
            with proxy.session() as session:
                session.execute(text("INSERT INTO demo VALUES (1)"))
            with self.assertRaises(ValueError):
                with proxy.session() as session:
                    session.execute(text("INSERT INTO demo VALUES (2)"))
                    raise ValueError("rollback")
            with proxy.session() as session:
                self.assertEqual(session.execute(text("SELECT value FROM demo")).scalars().all(), [1])
                self.assertEqual(session.execute(text("PRAGMA foreign_keys")).scalar(), 1)
        finally:
            proxy.dispose()
        self.assertIsNone(proxy._engine)

    def test_database_driver_selection(self):
        for source, expected in [("sqlite:///x.db", "sqlite+pysqlite"),
                                 ("mysql://user:password@localhost/db", "mysql+pymysql"),
                                 ("pgsql://user:password@localhost/db", "postgresql+psycopg")]:
            self.assertEqual(DatabaseConfig(source).sqlalchemy_url().drivername, expected)
        with self.assertRaises(ValueError):
            DatabaseConfig("oracle://localhost/db").sqlalchemy_url()


@unittest.skipUnless(importlib.util.find_spec("aiosqlite") and importlib.util.find_spec("greenlet"),
                     "异步 SQLite 驱动尚未安装")
class AsyncDatabaseTests(unittest.IsolatedAsyncioTestCase):
    async def test_auto_and_manual_transactions(self):
        proxy = DatabaseProxy(DatabaseConfig("sqlite:///:memory:"))
        try:
            async with proxy.async_session() as session:
                await session.execute(text("CREATE TABLE demo (value INTEGER)"))
            async with proxy.async_session() as session:
                await session.execute(text("INSERT INTO demo VALUES (1)"))
            with self.assertRaises(ValueError):
                async with proxy.async_session() as session:
                    await session.execute(text("INSERT INTO demo VALUES (2)"))
                    raise ValueError("rollback")
            async with proxy.async_session(auto_commit=False) as session:
                await session.execute(text("INSERT INTO demo VALUES (3)"))
                await session.commit()
                await session.execute(text("INSERT INTO demo VALUES (4)"))
                await session.rollback()
                await session.execute(text("INSERT INTO demo VALUES (5)"))
            async with proxy.async_session() as session:
                self.assertEqual((await session.execute(text("SELECT value FROM demo ORDER BY value"))).scalars().all(), [1, 3])
        finally:
            await proxy.adispose()
        self.assertIsNone(proxy._async_engine)
