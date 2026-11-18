"""带获取超时的异步锁：只限制等锁时间，临界区本身不设限。"""
import asyncio
from time import monotonic

from loguru import logger

from .exceptions import StorageError


class TimedLock:
    """配合 ``async with`` 使用，获取超时抛 StorageError，避免请求无限排队。

    用法与 ``asyncio.Lock`` 一致，但不可重入：同一任务重复获取会等到超时。
    """

    def __init__(self, timeout: float, *, name: str = "lock", warn_after: float = 1.0) -> None:
        if timeout <= 0:
            raise ValueError("锁等待超时必须大于 0")
        self._lock = asyncio.Lock()
        self.timeout = timeout
        self.name = name
        self.warn_after = warn_after

    def locked(self) -> bool:
        return self._lock.locked()

    async def __aenter__(self) -> "TimedLock":
        started = monotonic()
        try:
            await asyncio.wait_for(self._lock.acquire(), self.timeout)
        except TimeoutError:
            logger.warning("等待{}超时（{}s）", self.name, self.timeout)
            raise StorageError(f"等待{self.name}超时（{self.timeout}s）") from None
        waited = monotonic() - started
        if waited >= self.warn_after:
            logger.warning("等待{}耗时 {:.3f}s", self.name, waited)
        return self

    async def __aexit__(self, exc_type, exc, traceback) -> bool:
        self._lock.release()
        return False
