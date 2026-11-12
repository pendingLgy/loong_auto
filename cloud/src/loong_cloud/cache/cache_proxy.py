"""配置驱动的异步缓存代理。"""

from typing import Any

from loguru import logger

from loong_cloud.config.config_cache import CacheConfig
from .cache_base import BaseCache
from .registry_cache import resolve_cache


class CacheProxy:
    def __init__(self, config: CacheConfig):
        self.config = config
        backend = resolve_cache(config.cache_type)
        if not issubclass(backend, BaseCache):
            raise TypeError("缓存后端必须继承 BaseCache")
        self._backend: BaseCache = backend(config)

    def _build_key_prefix(self, key: str) -> str:
        return f"{self.config.prefix}:{key}"

    async def start_proxy(self) -> None:
        await self._backend.start()
        logger.info("cache proxy started")


    async def status(self) -> bool:
        status = await self._backend.status()
        return status

    async def close(self) -> None:
        await self._backend.close()

    async def get(self, key: str, default: Any = None) -> Any:
        return await self._backend.get(self._build_key_prefix(key), default)

    async def exists(self, key: str) -> bool:
        return await self._backend.exists(self._build_key_prefix(key))

    async def set(self, key: str, value: Any, ttl: float | int | None = None) -> None:
        await self._backend.set(self._build_key_prefix(key), value, ttl)

    async def delete(self, key: str) -> bool:
        return await self._backend.delete(self._build_key_prefix(key))

    async def clear(self) -> None:
        """只清空当前 prefix 对应的缓存分区。"""
        await self._backend.clear()

    async def cleanup_expired(self) -> int:
        return await self._backend.cleanup_expired()
