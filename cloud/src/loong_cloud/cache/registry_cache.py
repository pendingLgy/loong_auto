"""新增后端实现 BaseCache 并注册，不需要修改业务调用方。"""
from typing import Dict, List, Any

from loong_cloud.core.registry import Registry, Ref

BUILTIN_CACHES: Dict[str, str] = {
    "sqlite": "loong_cloud.cache.sqlite_cache.SqliteCache",
}

_REGISTRY = Registry("缓存后端", BUILTIN_CACHES)


def register_cache(name: str, ref: Ref) -> None:
    "登记缓存后端：ref 可为类对象，也可为点分路径字符串。"
    _REGISTRY.register(name, ref)


def register_cache_provider(name: str):
    "装饰器形式登记缓存后端。"
    return _REGISTRY.decorator(name)


def is_cache_registered(name: str) -> bool:
    "判断缓存后端是否已登记。"
    return name in _REGISTRY


def available_caches() -> List[str]:
    "返回已登记的后端名，按字典序排列。"
    return _REGISTRY.names()


def resolve_cache(name: str) -> Any:
    "按后端名取得实现类，路径登记的在此惰性导入。"
    return _REGISTRY.resolve(name)
