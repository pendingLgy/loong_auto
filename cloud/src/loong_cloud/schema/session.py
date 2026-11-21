"""会话消息表。"""

from sqlalchemy import (
    JSON,
    BigInteger,
    Column,
    DateTime,
    Index,
    Integer,
    MetaData,
    SmallInteger,
    String,
    Table,
    Text,
)


def session_message_table(metadata: MetaData, prefix: str = "") -> Table:
    """保存一次会话发送给 LLM 的完整消息快照。"""
    return Table(
        f"{prefix}session_message", metadata,
        Column("id", BigInteger, primary_key=True),
        Column("tenant_id", BigInteger, nullable=False),
        Column("session_id", String(64), nullable=False),
        Column("user_id", String(64), nullable=False),
        Column("session_title", String(256), nullable=True),
        Column("workspace_id", BigInteger, nullable=True,comment="关联的工作目录 id"),
        Column("version", Integer, nullable=False, default=1),
        Column("message_count", Integer, nullable=False, default=0),
        Column("message_size_kb", Integer, nullable=False, default=0, comment="消息内容大小，单位 KB"),
        Column("messages", JSON, nullable=False),
        Column("context_compressed", SmallInteger, nullable=False, default=0,
               comment="是否已进行 LLM 上下文压缩"),
        Column("context_summary", Text, nullable=True,
               comment="上下文压缩后的摘要内容"),
        Column("context_compression_version", String(32), nullable=True,
               comment="上下文压缩策略或版本"),
        Column("is_archived", SmallInteger, nullable=False, default=0, comment="是否已归档：0-否，1-是"),
        Column("is_deleted", SmallInteger, nullable=False, default=0, comment="逻辑删除标志：0-未删除，1-已删除"),
        Column("created_at", DateTime(timezone=True), nullable=False),
        Index(f"idx_{prefix}session_message_identity", "tenant_id", "user_id", "session_id", unique=True),
        Index(f"idx_{prefix}session_message_workspace", "workspace_id"),
    )

