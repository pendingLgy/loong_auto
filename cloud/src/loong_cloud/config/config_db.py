"""数据库分类配置与连接池配置；配置表示不输出凭证。"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PoolConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    size: int = Field(default=5, ge=1, description="连接池大小")
    max_overflow: int = Field(default=10, ge=0, description="允许的额外连接数")
    timeout: float = Field(default=30, gt=0, description="获取连接的超时时间（秒）")
    recycle: int = Field(default=1800, ge=-1, description="连接回收时间（秒），-1 禁用")
    pre_ping: bool = Field(default=True, description="获取连接前检查连接有效性")


class SqliteConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    database: str = Field(default="loong-cloud.db", description="SQLite 文件路径或 :memory:")
    print_sql: bool = Field(default=False, description="print SQL")

    # ---------------- SQLite 可选连接/驱动参数 ----------------
    timeout: float = Field(
        default=30.0,
        description="数据库写锁等待超时时间（秒），避免并发写入时立即抛出 database is locked"
    )
    isolation_level: str = Field(
        default="",
        description="事务隔离级别：DEFERRED, IMMEDIATE, EXCLUSIVE, AUTOCOMMIT，留空则使用驱动默认"
    )
    check_same_thread: bool = Field(
        default=False,
        description="是否强制检查同线程访问（在异步或多线程连接池场景下通常设为 False）"
    )


class DatabaseConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    db_type: Literal["sqlite", "mysql", "pgsql"] = Field(default="sqlite", description="数据库类型")
    table_prefix: str = Field(default="loong")

    sqlite: SqliteConfig = Field(default_factory=SqliteConfig, description="sqlite配置")

    pool: PoolConfig = Field(default_factory=PoolConfig, description="连接池配置")
