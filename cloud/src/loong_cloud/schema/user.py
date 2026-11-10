from typing import Any

from sqlalchemy import Table, Column, BigInteger, String, DateTime, SmallInteger, Index, func, MetaData


def user_table(table_metadata: MetaData, prefix: str = "") -> Any:
    messages_table_name = prefix + "user"

    USER_TABLE = Table(
        messages_table_name,
        table_metadata,
        # --- 基础与主键 ---
        Column("id", BigInteger, primary_key=True, comment="主键ID"),
        Column("tenant_id", BigInteger, nullable=False, comment="租户ID"),
        Column("user_id", BigInteger, nullable=True, comment="业务层用户ID/外部系统ID"),

        # --- 核心业务/身份信息 ---
        Column("role", String(32), nullable=True, default="user", comment="角色: admin/user/guest"),
        Column("name", String(256), nullable=True, comment="用户真实姓名/昵称"),
        Column("username", String(128), nullable=True, comment="登录用户名"),
        Column("email", String(256), nullable=True, comment="电子邮箱"),
        Column("phone", String(32), nullable=True, comment="手机号"),
        Column("password_hash", String(256), nullable=True, comment="密码哈希"),

        # --- 状态与控制 ---
        Column("status", SmallInteger, nullable=False, default=1, comment="状态: 0-禁用, 1-正常, 2-锁定"),
        Column("is_deleted", SmallInteger, nullable=False, default=0, comment="软删除标志: 0-未删除, 1-已删除"),

        # --- 审计字段 ---
        Column("created_at", DateTime(timezone=True), nullable=False, comment="创建时间"),
        Column("updated_at", DateTime(timezone=True), nullable=False, comment="更新时间"),

        # --- 索引定义 ---
        Index(f"idx_{prefix}_tenant_user", "tenant_id", "user_id", unique=True),
        Index(f"idx_{prefix}_tenant_email", "tenant_id", "email"),
        Index(f"idx_{prefix}_tenant_phone", "tenant_id", "phone"),
        Index(f"idx_{prefix}_created_at", "created_at"),
    )

    return USER_TABLE


def login_log_table(table_metadata: MetaData, prefix: str = "") -> Any:
    log_table_name = prefix + "login_log"

    LOGIN_LOG_TABLE = Table(
        log_table_name,
        table_metadata,
        # --- 基础与主键 ---
        Column("id", BigInteger, primary_key=True, comment="主键ID"),
        Column("tenant_id", BigInteger, nullable=False, comment="租户ID"),
        Column("user_id", BigInteger, nullable=True, comment="关联的用户ID（登录失败时可能为空）"),

        # --- 登录主体信息 ---
        Column("username", String(128), nullable=True, comment="尝试登录的用户名/账号"),

        # --- 状态与结果 ---
        Column("status", SmallInteger, nullable=False, comment="登录结果: 1-成功, 0-失败"),
        Column("msg", String(256), nullable=True, comment="提示信息/失败原因（如密码错误、账号锁定）"),

        # --- 环境与客户端审计 ---
        Column("ip", String(64), nullable=True, comment="客户端IP地址"),
        Column("user_agent", String(512), nullable=True, comment="客户端UA（浏览器/设备信息）"),
        Column("location", String(128), nullable=True, comment="登录地理位置（IP解析）"),

        # --- 时间审计字段 ---
        Column("login_time", DateTime(timezone=True), nullable=False, comment="登录时间"),

        # --- 索引设计 ---
        Index(f"idx_{prefix}_log_tenant_user", "tenant_id", "user_id"),  # 按租户及用户查询登录历史
        Index(f"idx_{prefix}_log_tenant_time", "tenant_id", "login_time"),  # 按租户及时间范围审计日志
        Index(f"idx_{prefix}_log_ip", "ip"),  # 根据IP排查安全风险
    )

    return LOGIN_LOG_TABLE