"""模型原始消息"""

from sqlalchemy import (
    JSON,
    BigInteger,
    Column,
    DateTime,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
)


def message_table(metadata: MetaData, prefix: str = "") -> Table:
    return Table(
        f"{prefix}message", metadata,
        Column("id", BigInteger, primary_key=True),
        Column("tenant_id", BigInteger, nullable=False),
        Column("user_id", String(64), nullable=False),
        Column("session_id", String(64), nullable=False),
        Column("model", String(128), nullable=True),
        Column("message_id", String(128), nullable=True),
        Column("created", BigInteger, nullable=True),
        Column("role", String(32), nullable=False),
        Column("raw", JSON, nullable=True),
        Column("finish_reason", String(64), nullable=True),
        Column("status", String(32), nullable=False, default="start"),
        Column("input_tokens", Integer, nullable=True, default=0),
        Column("output_tokens", Integer, nullable=True, default=0),
        Column("total_tokens", Integer, nullable=True, default=0),
        Column("content", Text, nullable=False, default=""),
        Column("tool_calls", JSON, nullable=True),
        Column("tool_call_id", String(128), nullable=True),
        Column("tool_call_messages", JSON, nullable=True),
        Column("remote_tool_calls", JSON, nullable=True),
        Column("created_at", DateTime(timezone=True), nullable=False),
        Index(f"idx_{prefix}message_identity", "tenant_id", "user_id", "session_id", "id"),
    )
