from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
)


def get_tool_tasks_table(metadata: MetaData, prefix: str = "") -> Table:
    pending_tool_tasks_table = Table(
        f"{prefix}pending_tool_tasks",
        metadata,
        Column("id", Integer, autoincrement=True, primary_key=True),

        Column("tool_id", String(128), nullable=False, comment="工具调用ID (LLM tool_call_id)"),
        Column("session_id", String(128), nullable=False, comment="会话ID"),

        Column("tool_name", String(64), nullable=False, comment="工具名称"),
        Column("description", String(255), nullable=True, comment="操作描述"),
        Column("request_data", Text, nullable=False, comment="工具请求参数 JSON"),
        Column("summary", Text, nullable=False, comment="操作摘要"),
        Column("dangerous", Boolean, default=False, nullable=False, comment="危险操作"),
        Column("risk_reason", Text, nullable=True, comment="高风险原因说明"),
        Column("status", String(32), default="pending", nullable=False, index=True, comment="任务状态"),
        Column("created_at", DateTime, default=None, nullable=True, comment="挂起创建时间"),
        Column("updated_at", DateTime, default=None, nullable=True, comment="状态更新时间"),

        # 💡 核心：声明 (session_id, tool_id) 联合唯一约束（自带复合索引，加速查询与防重）
        UniqueConstraint("session_id", "tool_id", name=f"{prefix}uq_session_tool_id"),
        sqlite_autoincrement=True,
    )

    # 复合索引优化：按 session_id + status 快速查询未完成任务
    Index(f"{prefix}idx_session_status", pending_tool_tasks_table.c.session_id, pending_tool_tasks_table.c.status)

    return pending_tool_tasks_table


def get_session_configs_table(metadata: MetaData, prefix: str = "") -> Table:
    """会话级工具配置：放行策略与允许的工作目录列表。"""
    session_configs_table = Table(
        f"{prefix}session_configs",
        metadata,
        Column("id", Integer, autoincrement=True, primary_key=True),
        Column("workspace_id", BigInteger, comment="工作空间id"),
        Column("session_id", String(128), comment="业务会话ID"),
        Column("workspace_mode", String(32), nullable=False, default="read_only",
               comment="放行模式: read_only / workspace_write / full"),
        Column("workspaces", Text, nullable=False, default="[]",
               comment="允许的工作目录 JSON 数组"),
        Column("created_at", DateTime, default=None, nullable=True, comment="创建时间"),
        Column("updated_at", DateTime, default=None, nullable=True, comment="更新时间"),
        sqlite_autoincrement=True,
    )

    return session_configs_table


def get_supplier_config_table(metadata: MetaData, prefix: str = "") -> Table:
    """供应商 API Key 配置。"""
    supplier_config_table = Table(
        f"{prefix}supplier_config",
        metadata,
        Column("id", Integer, autoincrement=True, primary_key=True),
        Column("provider", String(64), nullable=False, comment="模型供应商"),
        Column("alias", String(256), nullable=True, comment="供应商显示名称"),
        Column("base_url", String(512), nullable=True, comment="供应商 API Base URL"),
        Column("api_key", Text, nullable=False, comment="供应商 API Key"),
        Column("created_at", DateTime, default=None, nullable=True, comment="创建时间"),
        Column("updated_at", DateTime, default=None, nullable=True, comment="更新时间"),
        UniqueConstraint("provider", name=f"{prefix}uq_supplier_config_provider"),
        sqlite_autoincrement=True,
    )
    return supplier_config_table


def get_supplier_model_option_table(metadata: MetaData, prefix: str = "") -> Table:
    """供应商下各模型的启用配置。"""
    supplier_model_option_table = Table(
        f"{prefix}supplier_model_option",
        metadata,
        Column("id", Integer, autoincrement=True, primary_key=True),
        Column("provider", String(64), nullable=False, comment="模型供应商"),
        Column("model", String(128), nullable=False, comment="模型名称"),
        Column("enabled", Boolean, nullable=False, default=True, comment="模型是否启用"),
        Column("created_at", DateTime, default=None, nullable=True, comment="创建时间"),
        Column("updated_at", DateTime, default=None, nullable=True, comment="更新时间"),
        UniqueConstraint("provider", "model", name=f"{prefix}uq_supplier_model_option_provider_model"),
        sqlite_autoincrement=True,
    )
    return supplier_model_option_table
