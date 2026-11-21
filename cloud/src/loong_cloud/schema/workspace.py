"""工作目录表。"""

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Index,
    MetaData,
    SmallInteger,
    String,
    Table,
    Text,
)


def workspace_table(metadata: MetaData, prefix: str = "") -> Table:
    """保存会话使用的工作目录。"""
    return Table(
        f"{prefix}workspace", metadata,
        Column("id", BigInteger, primary_key=True),
        Column("tenant_id", BigInteger, nullable=False),
        Column("user_id", String(64), nullable=False),
        Column("name", String(256), nullable=True),
        Column("path", Text, nullable=False, comment="json数组[path_1,path_2]"),
        Column("is_deleted", SmallInteger, nullable=False, default=0,
               comment="逻辑删除标记：0-未删除，1-已删除"),
        Column("created_at", DateTime(timezone=True), nullable=False),
        Column("updated_at", DateTime(timezone=True), nullable=True),
        Index(f"idx_{prefix}workspace_identity", "tenant_id", "user_id", "id"),
    )
