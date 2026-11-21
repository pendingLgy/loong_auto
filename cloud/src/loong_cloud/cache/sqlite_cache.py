"""使用 SQLAlchemy Core Table 和异步引擎实现 SQLite JSON 缓存。"""

import asyncio
import json
import math
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from threading import Event, Thread
from typing import Any

from loguru import logger
from sqlalchemy import (
    URL,
    Column,
    Float,
    Index,
    Integer,
    MetaData,
    Table,
    Text,
    delete,
    or_,
    select,
)
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool

from loong_cloud.cache.cache_base import BaseCache
from loong_cloud.config.config_cache import CacheConfig

metadata = MetaData()
cache_entries = Table(
    "loong_cache_entries",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("namespace", Text, nullable=False),
    Column("key", Text, nullable=False),
    Column("value", Text, nullable=False),
    Column("expires_at", Float, nullable=True),
    Index("uq_loong_cache_namespace_key", "namespace", "key", unique=True),
    Index("long_cache_entries_expiry", "namespace", "expires_at"),
    sqlite_autoincrement=True,
)


class SqliteCache(BaseCache):
    def __init__(self, config: CacheConfig):
        super().__init__(config)
        self._engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None
        self._lock = asyncio.Lock()
        self._lifecycle_lock = asyncio.Lock()
        self._cleanup_stop = Event()
        self._cleanup_thread: Thread | None = None

    async def status(self) -> bool:
        await self.get("test")
        return True

    async def start(self) -> None:
        async with self._lifecycle_lock:
            if self._engine is not None:
                return
            pool = self.config.sqlite.pool
            engine = create_async_engine(
                URL.create("sqlite+aiosqlite", database=self.config.sqlite.database),
                connect_args={"timeout": self.config.sqlite.timeout},
                poolclass=AsyncAdaptedQueuePool,
                pool_size=pool.size,
                max_overflow=pool.max_overflow,
                pool_timeout=pool.timeout,
                pool_recycle=pool.recycle,
                pool_pre_ping=pool.pre_ping,
            )
            try:
                async with engine.begin() as connection:
                    await connection.run_sync(metadata.create_all, checkfirst=True)
            except BaseException:
                await engine.dispose()
                raise
            self._engine = engine
            self._session_factory = async_sessionmaker(engine, expire_on_commit=False)

            self._cleanup_stop.clear()
            self._cleanup_thread = Thread(
                target=self._cleanup_worker,
                name="sqlite-cache-cleanup",
                daemon=True,
            )
            try:
                self._cleanup_thread.start()
            except BaseException:
                self._cleanup_thread = None
                self._session_factory = None
                self._engine = None
                await engine.dispose()
                raise

    def _cleanup_worker(self) -> None:
        """在线程自己的事件循环中直接调用清理方法，使用专用连接。"""
        logger.info("cache clean thread start")
        try:
            with asyncio.Runner() as runner:
                engine = create_async_engine(
                    URL.create("sqlite+aiosqlite", database=self.config.sqlite.database),
                    connect_args={"timeout": self.config.sqlite.timeout},
                    poolclass=NullPool,
                )
                sessions = async_sessionmaker(engine, expire_on_commit=False)
                try:
                    while not self._cleanup_stop.wait(self.config.sqlite.cleanup_interval):
                        try:
                            runner.run(self.cleanup_expired(sessions))
                        except Exception:
                            logger.exception("后台清理过期缓存失败")
                finally:
                    runner.run(engine.dispose())
        except Exception:
            logger.exception("缓存清理线程异常退出")
        finally:
            logger.info("cache clean thread stopped")

    async def close(self) -> None:
        async with self._lifecycle_lock:
            self._cleanup_stop.set()
            if self._cleanup_thread is not None:
                # 不占用写锁或阻塞事件循环，允许正在执行的清理完成。
                await asyncio.to_thread(self._cleanup_thread.join)
                self._cleanup_thread = None
            async with self._lock:
                if self._engine is not None:
                    await self._engine.dispose()
                    self._engine = None
                    self._session_factory = None

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """提供独立会话，正常退出提交，异常回滚，退出后关闭。"""
        async with self._session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    async def get(self, key: str, default: Any = None) -> Any:
        statement = select(cache_entries.c.value).where(
            cache_entries.c.namespace == self.config.prefix,
            cache_entries.c.key == key,
            or_(cache_entries.c.expires_at.is_(None), cache_entries.c.expires_at > time.time()),
        )
        async with self.session() as session:
            row = (await session.execute(statement)).first()
        return default if row is None else json.loads(row[0])

    async def exists(self, key: str) -> bool:
        statement = select(cache_entries.c.id).where(
            cache_entries.c.namespace == self.config.prefix,
            cache_entries.c.key == key,
            or_(cache_entries.c.expires_at.is_(None), cache_entries.c.expires_at > time.time()),
        ).limit(1)
        async with self.session() as session:
            row = (await session.execute(statement)).first()
        return row is not None

    async def set(self, key: str, value: Any, ttl: float | None = None) -> None:
        if ttl is not None and (not math.isfinite(ttl) or ttl <= 0):
            raise ValueError("ttl 必须为有限正数；None 表示不过期")
        payload = json.dumps(value, ensure_ascii=False, allow_nan=False)
        expires_at = None if ttl is None else time.time() + ttl
        statement = insert(cache_entries).values(
            namespace=self.config.prefix, key=key, value=payload, expires_at=expires_at,
        )
        statement = statement.on_conflict_do_update(
            index_elements=[cache_entries.c.namespace, cache_entries.c.key],
            set_={"value": statement.excluded.value, "expires_at": statement.excluded.expires_at},
        )
        async with self._lock:
            async with self.session() as session:
                await session.execute(statement)

    async def delete(self, key: str) -> bool:
        statement = delete(cache_entries).where(
            cache_entries.c.namespace == self.config.prefix,
            cache_entries.c.key == key,
        )
        async with self._lock:
            async with self.session() as session:
                result = await session.execute(statement)
                return result.rowcount > 0

    async def clear(self) -> None:
        statement = delete(cache_entries).where(cache_entries.c.namespace == self.config.prefix)
        async with self._lock:
            async with self.session() as session:
                await session.execute(statement)

    async def cleanup_expired(
        self, session_factory: async_sessionmaker[AsyncSession] | None = None,
    ) -> int:
        """线程传入专用会话工厂；普通调用使用当前实例的会话工厂。"""
        sessions = session_factory if session_factory is not None else self._session_factory
        if sessions is None:
            raise RuntimeError("缓存尚未启动")
        statement = delete(cache_entries).where(
            cache_entries.c.namespace == self.config.prefix,
            cache_entries.c.expires_at <= time.time(),
        )
        async with sessions.begin() as session:
            result = await session.execute(statement)
            count = result.rowcount
        logger.info("remove cache key count {}", count)
        return count
