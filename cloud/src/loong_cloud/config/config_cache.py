"""缓存后端配置。"""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config_db import PoolConfig


class SqliteCacheConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    database: str = Field(default="loong-cache.db", min_length=1, description="SQLite 缓存文件路径，仅支持文件模式")
    timeout: float = Field(default=30.0, gt=0, description="SQLite 写锁等待时间（秒）")
    cleanup_interval: float = Field(default=5.0, gt=0, allow_inf_nan=False, description="后台清理过期缓存的间隔（秒）")

    pool: PoolConfig = Field(default_factory=PoolConfig, description="连接池配置")

    @field_validator("database")
    @classmethod
    def validate_database(cls, value: str) -> str:
        if not value.strip() or value == ":memory:":
            raise ValueError("SQLite 缓存仅支持非空文件路径，不支持内存模式")
        return value


class CacheConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    prefix: str = Field(default="loong", description="cache key prefix")
    cache_type: str = Field(default="sqlite", min_length=1, description="已注册的缓存后端名称")
    sqlite: SqliteCacheConfig = Field(default_factory=SqliteCacheConfig, description="SQLite 缓存配置")
