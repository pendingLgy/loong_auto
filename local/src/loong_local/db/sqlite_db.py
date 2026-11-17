import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, List, AsyncIterator

from loguru import logger
from sqlalchemy import Table
from sqlalchemy import URL, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker, AsyncEngine

from loong_local.config.config_db import DatabaseConfig
from loong_local.core.exceptions import StorageError
from loong_local.schema import GLOBAL_TABLE_METADATA


class AsyncSqliteDB:

    def __init__(self, sqlite_config: DatabaseConfig) -> None:
        self.sqlite_config = sqlite_config
        self.sqlite_config = sqlite_config.sqlite
        self.pool_config = sqlite_config.pool
        self.engine: AsyncEngine | None = None
        self.session: async_sessionmaker[AsyncSession] | None = None
        self._lock = asyncio.Lock()

    @classmethod
    def from_config(cls, db_config: Any, pool_config: Any):
        return cls(sqlite_config=db_config, pool_config=pool_config)

    def _path_exsit(self, path: str) -> None:
        """确保库文件所在目录存在。"""
        parent = os.path.dirname(os.path.abspath(path))
        if parent and not os.path.isdir(parent):
            os.makedirs(parent, exist_ok=True)

    @property
    def status(self) -> bool:
        return self.engine is not None

    async def start(self):

        async with self._lock:
            if self.engine is not None:
                return

            self._path_exsit(self.sqlite_config.database)

            url = URL.create("sqlite+aiosqlite", database=self.sqlite_config.database)
            connection_string = url.render_as_string(hide_password=False)

            try:
                self.engine = create_async_engine(
                    connection_string,
                    echo=self.sqlite_config.print_sql,
                    pool_size=self.pool_config.size,
                    max_overflow=self.pool_config.max_overflow,
                    pool_timeout=self.pool_config.timeout,
                    pool_recycle=self.pool_config.recycle,
                    pool_pre_ping=self.pool_config.pre_ping,
                    # 只有当 isolation_level 非空时才传入
                    **({"isolation_level": self.sqlite_config.isolation_level} if self.sqlite_config.isolation_level else {}),
                    connect_args={
                        "timeout": self.sqlite_config.timeout,
                        "check_same_thread": self.sqlite_config.check_same_thread,
                    }
                )

                self.session = async_sessionmaker(
                    bind=self.engine,
                    class_=AsyncSession,
                    expire_on_commit=False,
                )

                if self.sqlite_config.print_sql:
                    # 开启 SQLAlchemy engine 和 pool 的调试日志
                    logging.basicConfig()
                    logging.getLogger("sqlalchemy.pool").setLevel(logging.INFO)

            except Exception as exc:
                raise StorageError("无法创建异步 SQLite 引擎：" + str(exc)) from exc

            try:
                missing = await self.table_miss()
                if not missing:
                    logger.info("tables exist")
                else:
                    async with self.engine.begin() as conn:
                        for miss_table in missing:
                            table: Table = miss_table
                            logger.info(f"create table {table.name}")
                            await conn.run_sync(table.create, checkfirst=True)
            except Exception as exc:
                raise StorageError("建表失败" + ": " + str(exc)) from exc

        return self.engine, self.session

    async def table_miss(self) -> List[Any]:

        table_metadata = GLOBAL_TABLE_METADATA

        all_tables = list(table_metadata.sorted_tables)
        table_names = [table.name for table in all_tables]

        placeholders = ", ".join([f":t{i}" for i in range(len(table_names))])
        params = {f"t{i}": name for i, name in enumerate(table_names)}

        query_sql = f"SELECT name FROM sqlite_master WHERE type='table' AND name IN ({placeholders})"

        async with self.engine.connect() as conn:
            result = await conn.execute(text(query_sql), params)
            existing_tables = {row[0] for row in result.fetchall()}

        return [table for table in all_tables if table.name not in existing_tables]

    async def close(self):
        await self.engine.dispose()

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """使用标准 sessionmaker 管理会话生命周期"""
        async with self.session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    @asynccontextmanager
    async def session_manual_tx(self) -> AsyncIterator[AsyncSession]:
        """使用标准 sessionmaker 管理会话生命周期, 许哟啊手动提交事务"""
        async with self.session() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
