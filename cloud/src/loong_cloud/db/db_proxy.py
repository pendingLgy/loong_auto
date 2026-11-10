
from __future__ import annotations

from contextlib import asynccontextmanager
from threading import RLock
from typing import Iterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from loong_cloud.config.config_db import DatabaseConfig
from loong_cloud.db.db_base import BaseDB
from loong_cloud.db.registry_db import resolve_db


class AsyncDatabaseProxy:
    """
    代理模式：业务仅通过代理获取 Session，具体连接由 SQLAlchemy 创建
    """
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self._db: BaseDB | None = None
        self._lock = RLock()
        self._async_engine: AsyncEngine | None = None
        self._async_session: async_sessionmaker[AsyncSession] | None = None

    @property
    def status(self) -> bool:
        return self._async_engine is not None

    async def start_proxy(self):
        if self._async_engine is None:
            with self._lock:
                db_config = self.config.sqlite
                pool_config = self.config.pool

                db_class = resolve_db(self.config.db_type)
                self._db = db_class.from_config(db_config, pool_config)

                engine, session = await self._db.start()

                self._async_engine = engine
                self._async_session = session

    async def close_db(self):
        await self._db.close()

    @asynccontextmanager
    async def session(self) -> Iterator[AsyncSession]:
        """使用标准 sessionmaker 管理会话生命周期"""
        async with self._async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    @asynccontextmanager
    async def session_manual_tx(self) -> Iterator[AsyncSession]:
        """使用标准 sessionmaker 管理会话生命周期, 许哟啊手动提交事务"""
        async with self._async_session() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
