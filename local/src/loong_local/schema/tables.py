from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)


def get_gateway_table(metadata: MetaData, prefix: str = "") -> Table:
    """
        本地网关实例表（保存首次运行生成的稳定 gateway_id）
    :param metadata:
    :param prefix:
    :return:
    """

    gateway_table = Table(
        f"{prefix}gateway",
        metadata,
        Column("id", Integer, primary_key=True),
        CheckConstraint("id = 1", name="ck_gateway_single_row"),
        Column("gateway_id", String(64), nullable=False, comment="本地网关安装实例稳定唯一标识"),
        Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    )

    return gateway_table


def get_tool_batch_table(metadata: MetaData, prefix: str = "") -> Table:
    """工具调用批次表（保存同轮 LLM 返回的完整调用顺序与续传上下文）"""
    tool_batch_table = Table(
        f"{prefix}tool_batches",
        metadata,
        Column("batch_id", String(64), primary_key=True, comment="工具批次唯一标识"),
        Column("gateway_id", String(64), nullable=False),
        Column("tenant_id", String(64), nullable=False),
        Column("user_id", String(64), nullable=False),
        Column("session_id", String(64), nullable=False, comment="业务对话会话ID"),
        Column("assistant_message_json", Text, nullable=False, comment="LLM生成的assistant工具调用消息JSON"),
        Column("tool_calls_json", Text, nullable=False, comment="完整tool_calls数组JSON，决定最终结果拼接顺序"),
        Column("cloud_results_json", Text, nullable=True, comment="cloud端已执行的tool_call_messages JSON"),
        Column("model_config_json", Text, nullable=True, comment="续传所需模型配置(不含明文API Key，仅存凭证引用)"),
        Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
        Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
        Index(f"{prefix}idx_tool_batches_owner_session", "gateway_id", "tenant_id", "user_id", "session_id"),
    )

    return tool_batch_table


def get_tool_approval_table(metadata: MetaData, prefix: str = "") -> Table:
    """人工审批记录表（核心审批状态机与幂等防重）"""

    tool_approval_table = Table(
        f"{prefix}tool_approvals",
        metadata,
        Column("approval_id", String(64), primary_key=True, comment="审批记录唯一标识"),
        Column("gateway_id", String(64), nullable=False),
        Column("tenant_id", String(64), nullable=False),
        Column("user_id", String(64), nullable=False),
        Column("session_id", String(64), nullable=False),
        Column("batch_id", String(64), nullable=False, comment="关联工具批次ID"),
        Column("call_id", String(64), nullable=False, comment="LLM工具调用的tool_call_id"),
        Column("tool_name", String(128), nullable=False, comment="工具名称"),
        Column("raw_arguments_json", Text, nullable=False, comment="原始工具调用参数JSON"),
        Column("args_digest", String(128), nullable=False, comment="参数摘要/哈希，用于恢复执行前校验防篡改"),
        Column("workspace", Text, nullable=True, comment="执行工作区路径"),
        Column("risk_reason", Text, nullable=True, comment="触发高危审批的风险原因"),
        Column(
            "status",
            String(32),
            nullable=False,
            default="PENDING",
            comment="审批状态: PENDING / APPROVED / REJECTED / CANCELLED",
        ),
        Column("version", Integer, nullable=False, default=1, comment="乐观锁版本号，保障并发条件更新"),
        Column("decided_by", String(64), nullable=True, comment="决定者标识(user_id 或 system)"),
        Column(
            "decision_source",
            String(32),
            nullable=True,
            comment="决定来源: user_manual(人工点击) / new_message(新消息自动拒绝) / timeout / cancel",
        ),
        Column("trigger_message_id", String(64), nullable=True, comment="触发自动拒绝的新消息ID(便于追溯)"),
        Column("decided_at", DateTime(timezone=True), nullable=True, comment="作出决定的时间"),
        Column("expires_at", DateTime(timezone=True), nullable=True, comment="可选的业务有效期"),
        Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
        Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
        # 核心唯一约束：防止同一调用重复到达时创建重复审批与执行任务
        UniqueConstraint(
            "gateway_id", "tenant_id", "user_id", "session_id", "call_id",
            name=f"{prefix}uq_approval_gateway_owner_session_call",
        ),
        Index(f"{prefix}idx_approvals_owner_status", "gateway_id", "tenant_id", "user_id", "status"),
        Index(f"{prefix}idx_approvals_session_status", "session_id", "status"),
    )

    return tool_approval_table


def get_tool_execution_table(metadata: MetaData, prefix: str = "") -> Table:
    """工具执行记录表（分离“审批通过”与“实际执行状态”，支持重启崩溃检测）"""

    tool_execution_table = Table(
        "tool_executions",
        metadata,
        Column("execution_id", String(64), primary_key=True, comment="唯一执行标识"),
        Column("approval_id", String(64), nullable=True, comment="关联审批ID(低危免审批工具可为空)"),
        Column("batch_id", String(64), nullable=False),
        Column("call_id", String(64), nullable=False),
        Column("gateway_id", String(64), nullable=False),
        Column("tenant_id", String(64), nullable=False),
        Column("user_id", String(64), nullable=False),
        Column("session_id", String(64), nullable=False),
        Column(
            "status",
            String(32),
            nullable=False,
            default="WAITING_APPROVAL",
            comment="执行状态: WAITING_APPROVAL / READY / RUNNING / SUCCEEDED / FAILED / SKIPPED / UNKNOWN",
        ),
        Column("worker_id", String(64), nullable=True, comment="原子领取任务的调度器实例标识"),
        Column("result_message_json", Text, nullable=True, comment="标准role=tool的结果消息JSON"),
        Column("error_message", Text, nullable=True, comment="执行异常或拒绝原因详情"),
        Column("started_at", DateTime(timezone=True), nullable=True),
        Column("finished_at", DateTime(timezone=True), nullable=True),
        Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
        Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
        UniqueConstraint("batch_id", "call_id", name=f"{prefix}uq_execution_batch_call"),
        Index(f"{prefix}idx_executions_status", "gateway_id", "status"),
    )

    return tool_execution_table


def get_cloud_submission_table(metadata: MetaData, prefix: str = "") -> Table:
    """
    Cloud 结果续传待提交表（保障断网/重启后有序幂等回传 cloud）
    :param metadata:
    :param prefix:
    :return:
    """

    cloud_submission_table = Table(
        f"{prefix}cloud_submissions",
        metadata,
        Column("submission_id", String(64), primary_key=True, comment="稳定幂等提交标识"),
        Column("batch_id", String(64), nullable=False),
        Column("gateway_id", String(64), nullable=False),
        Column("tenant_id", String(64), nullable=False),
        Column("user_id", String(64), nullable=False),
        Column("session_id", String(64), nullable=False),
        Column("ordered_messages_json", Text, nullable=False, comment="按tool_calls严格排序后的完整续传消息数组JSON"),
        Column(
            "status",
            String(32),
            nullable=False,
            default="PENDING",
            comment="续传状态: PENDING / SENDING / DELIVERED / UNKNOWN",
        ),
        Column("retry_count", Integer, nullable=False, default=0, comment="重试次数"),
        Column("last_error", Text, nullable=True, comment="最近一次提交失败原因"),
        Column("cloud_ack_json", Text, nullable=True, comment="cloud服务端幂等确认回执"),
        Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
        Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
        Index(f"{prefix}idx_submissions_owner_status", "gateway_id", "tenant_id", "user_id", "status"),
    )

    return cloud_submission_table


def get_sse_event_table(metadata: MetaData, prefix: str = "") -> Table:
    """SSE 持久化事件表（支持断连后通过 Last-Event-ID 补发通知）"""

    sse_event_table = Table(
        f"{prefix}sse_events",
        metadata,
        Column("event_id", Integer, primary_key=True, autoincrement=True, comment="单调递增事件ID，对应SSE id字段"),
        Column("gateway_id", String(64), nullable=False),
        Column("tenant_id", String(64), nullable=False),
        Column("user_id", String(64), nullable=False),
        Column("session_id", String(64), nullable=False),
        Column("biz_id", String(64), nullable=True, comment="关联业务ID(如approval_id或batch_id)"),
        Column("event_type", String(64), nullable=False, comment="事件类型: tool_approval_required / tool_called 等"),
        Column("payload_json", Text, nullable=False, comment="SSE事件数据载荷JSON"),
        Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
        Index(f"{prefix}idx_sse_events_owner_seq", "gateway_id", "tenant_id", "user_id", "event_id"),
    )

    return sse_event_table
