"""异步缓存契约；值必须可通过 JSON 序列化，TTL 单位为秒。"""

from abc import ABC, abstractmethod
from typing import Any

from loong_cloud.config.config_cache import CacheConfig


class BaseCache(ABC):
    def __init__(self, config: CacheConfig):
        self.config = config

    @abstractmethod
    async def status(self) -> bool: ...

    @abstractmethod
    async def start(self) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...

    @abstractmethod
    async def get(self, key: str, default: Any = None) -> Any: ...

    @abstractmethod
    async def exists(self, key: str) -> bool: ...

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: float | None = None) -> None: ...

    @abstractmethod
    async def delete(self, key: str) -> bool: ...

    @abstractmethod
    async def clear(self) -> None: ...

    @abstractmethod
    async def cleanup_expired(self) -> int: ...
