import json
from typing import Any

from sqlalchemy import and_, insert, select, update

from loong_contracts.utis.datetime_util import utcnow
from loong_contracts.utis.uuid_util import uuid_str
from loong_local.commons.constant import ExecutionStatus, SubmissionStatus, ToolCallSpec, ApprovalStatus
from loong_local.core.exceptions import ApprovalNotFoundError, ApprovalConflictError
from loong_local.db import AsyncSqliteDB
from loong_local.schema import GLOBAL_TABLES


class ApprovalPersistenceService:
    def __init__(self, db: AsyncSqliteDB):
        self.db = db
        self.gateway_table = GLOBAL_TABLES.gateway
        self.tool_execution_table = GLOBAL_TABLES.tool_execution
        self.cloud_submission_table = GLOBAL_TABLES.cloud_submission
        self.tool_approval_table = GLOBAL_TABLES.tool_approval
        self.tool_batch_table = GLOBAL_TABLES.tool_batch
        self.sse_event_table = GLOBAL_TABLES.sse_event

    # =========================================================================
    # 1. 网关启动恢复：获取稳定 gateway_id + 崩溃状态安全标记
    # =========================================================================
    async def startup_recovery(self) -> str:
        """
        1. 确保 gateway 表存在 id=1 的稳定 gateway_id。
        2. 将进程崩溃前处于 RUNNING 的执行记录标记为 UNKNOWN（禁止盲重试有副作用命令）。
        3. 将 SENDING 的云端续传记录标记为 UNKNOWN（需先向 cloud 核对状态）。
        """
        async with self.db.session() as session:
            row = (
                await session.execute(select(self.gateway_table.c.gateway_id).where(self.gateway_table.c.id == 1))
            ).first()
            if row is None:
                gateway_id = uuid_str()
                await session.execute(
                    insert(self.gateway_table).values(id=1, gateway_id=gateway_id, created_at=utcnow())
                )
            else:
                gateway_id = row[0]

            # 标记崩溃前 RUNNING 的执行记录为 UNKNOWN
            await session.execute(
                update(self.tool_execution_table)
                .where(
                    and_(
                        self.tool_execution_table.c.gateway_id == gateway_id,
                        self.tool_execution_table.c.status == ExecutionStatus.RUNNING.value,
                    )
                )
                .values(
                    status=ExecutionStatus.UNKNOWN.value,
                    error_message="网关进程重启，执行中任务结果未知，禁止自动重放",
                    updated_at=utcnow(),
                )
            )

            # 标记 SENDING 续传记录为 UNKNOWN
            await session.execute(
                update(self.cloud_submission_table)
                .where(
                    and_(
                        self.cloud_submission_table.c.gateway_id == gateway_id,
                        self.cloud_submission_table.c.status == SubmissionStatus.SENDING.value,
                    )
                )
                .values(
                    status=SubmissionStatus.UNKNOWN.value,
                    last_error="网关进程重启，续传状态未确认",
                    updated_at=utcnow(),
                )
            )

            return gateway_id

    # =========================================================================
    # 2. 创建工具调用批次、审批记录、执行记录与初始 SSE 事件（同事务 + 幂等）
    # =========================================================================
    async def create_batch_and_approvals(
            self,
            *,
            gateway_id: str,
            tenant_id: str,
            user_id: str,
            session_id: str,
            assistant_message: dict[str, Any],
            all_tool_calls: list[dict[str, Any]],
            remote_calls: list[ToolCallSpec],
            cloud_results: list[dict[str, Any]] | None = None,
            safe_model_config: dict[str, Any] | None = None,
            client_id: str | None = None,
    ) -> dict[str, Any]:
        """
        在一个事务中保存批次、审批、执行记录与 SSE 事件。
        若同一 call_id 已存在，则直接复用已有审批/执行记录（幂等）。
        """
        now = utcnow()
        batch_id = uuid_str()
        created_events: list[dict[str, Any]] = []
        approvals_out: list[dict[str, Any]] = []

        async with self.db.session() as session:
            # 1. 检查是否已有重复到达的 call_id
            call_ids = [c.call_id for c in remote_calls]
            existing_rows = (
                await session.execute(
                    select(self.tool_approval_table).where(
                        and_(
                            self.tool_approval_table.c.gateway_id == gateway_id,
                            self.tool_approval_table.c.tenant_id == tenant_id,
                            self.tool_approval_table.c.user_id == user_id,
                            self.tool_approval_table.c.session_id == session_id,
                            self.tool_approval_table.c.call_id.in_(call_ids),
                        )
                    )
                )
            ).mappings().all()
            existing_map = {r["call_id"]: dict(r) for r in existing_rows}

            # 若全部都已存在，直接幂等返回
            if len(existing_map) == len(remote_calls) and remote_calls:
                return {
                    "batch_id": existing_rows[0]["batch_id"],
                    "approvals": list(existing_map.values()),
                    "sse_events": [],
                    "reused": True,
                }

            # 2. 插入工具批次记录
            await session.execute(
                insert(self.tool_batch_table).values(
                    batch_id=batch_id,
                    gateway_id=gateway_id,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    session_id=session_id,
                    assistant_message_json=json.dumps(assistant_message, ensure_ascii=False),
                    tool_calls_json=json.dumps(all_tool_calls, ensure_ascii=False),
                    cloud_results_json=json.dumps(cloud_results or [], ensure_ascii=False),
                    model_config_json=json.dumps(safe_model_config, ensure_ascii=False)
                    if safe_model_config
                    else None,
                    created_at=now,
                    updated_at=now,
                )
            )

            # 3. 逐个创建审批与执行任务
            for spec in remote_calls:
                if spec.call_id in existing_map:
                    approvals_out.append(existing_map[spec.call_id])
                    continue

                execution_id = uuid_str()
                approval_id: str | None = None

                if spec.requires_approval:
                    approval_id = uuid_str()
                    approval_row = {
                        "approval_id": approval_id,
                        "gateway_id": gateway_id,
                        "tenant_id": tenant_id,
                        "user_id": user_id,
                        "session_id": session_id,
                        "batch_id": batch_id,
                        "call_id": spec.call_id,
                        "tool_name": spec.tool_name,
                        "raw_arguments_json": spec.arguments_json,
                        "args_digest": spec.args_digest,
                        "workspace": spec.workspace,
                        "risk_reason": spec.risk_reason,
                        "status": ApprovalStatus.PENDING.value,
                        "version": 1,
                        "created_at": now,
                        "updated_at": now,
                    }
                    await session.execute(insert(self.tool_approval_table).values(**approval_row))
                    approvals_out.append(approval_row)
                    exec_status = ExecutionStatus.WAITING_APPROVAL.value
                else:
                    exec_status = ExecutionStatus.READY.value

                # 插入执行记录
                await session.execute(
                    insert(self.tool_execution_table).values(
                        execution_id=execution_id,
                        approval_id=approval_id,
                        batch_id=batch_id,
                        call_id=spec.call_id,
                        gateway_id=gateway_id,
                        tenant_id=tenant_id,
                        user_id=user_id,
                        session_id=session_id,
                        status=exec_status,
                        created_at=now,
                        updated_at=now,
                    )
                )

                # 若需要审批，同时写入持久化 SSE 事件
                if spec.requires_approval and approval_id:
                    event_payload = {
                        "client_id": client_id,
                        "gateway_id": gateway_id,
                        "session_id": session_id,
                        "approval_id": approval_id,
                        "tool_call_id": spec.call_id,
                        "tool_name": spec.tool_name,
                        "workspace": spec.workspace,
                        "risk_reason": spec.risk_reason,
                        "dangerous": True,
                    }
                    res = await session.execute(
                        insert(self.sse_event_table).values(
                            gateway_id=gateway_id,
                            tenant_id=tenant_id,
                            user_id=user_id,
                            session_id=session_id,
                            biz_id=approval_id,
                            event_type="tool_approval_required",
                            payload_json=json.dumps(event_payload, ensure_ascii=False),
                            created_at=now,
                        )
                    )
                    created_events.append(
                        {
                            "event_id": res.inserted_primary_key[0],
                            "event_type": "tool_approval_required",
                            "data": event_payload,
                        }
                    )

        return {
            "batch_id": batch_id,
            "approvals": approvals_out,
            "sse_events": created_events,
            "reused": False,
        }

    # =========================================================================
    # 3. 人工提交审批决定（乐观锁条件更新 + 联动执行记录）
    # =========================================================================
    async def decide_approval(
            self,
            *,
            gateway_id: str,
            tenant_id: str,
            user_id: str,
            approval_id: str,
            approved: bool,
    ) -> dict[str, Any]:
        """
        处理用户的批准或拒绝请求：
        - 只有 PENDING 状态可被首次决定。
        - 重复提交相同决定幂等返回；提交冲突决定抛出 ApprovalConflictError。
        - 批准与置执行记录为 READY 在同一事务内完成。
        """
        now = utcnow()
        target_status = ApprovalStatus.APPROVED.value if approved else ApprovalStatus.REJECTED.value

        async with self.db.session() as session:
            row = (
                await session.execute(
                    select(self.tool_approval_table).where(
                        and_(
                            self.tool_approval_table.c.approval_id == approval_id,
                            self.tool_approval_table.c.gateway_id == gateway_id,
                            self.tool_approval_table.c.tenant_id == tenant_id,
                            self.tool_approval_table.c.user_id == user_id,
                        )
                    )
                )
            ).mappings().first()

            if row is None:
                raise ApprovalNotFoundError(f"审批记录不存在或无权限: {approval_id}")

            current_status = row["status"]
            if current_status != ApprovalStatus.PENDING.value:
                if current_status == target_status:
                    return {"approval": dict(row), "idempotent": True}
                raise ApprovalConflictError(
                    f"审批状态已变更为 {current_status}，无法修改为 {target_status}"
                )

            # 乐观锁条件更新
            upd = await session.execute(
                update(self.tool_approval_table)
                .where(
                    and_(
                        self.tool_approval_table.c.approval_id == approval_id,
                        self.tool_approval_table.c.status == ApprovalStatus.PENDING.value,
                        self.tool_approval_table.c.version == row["version"],
                    )
                )
                .values(
                    status=target_status,
                    version=row["version"] + 1,
                    decided_by=user_id,
                    decision_source="user_manual",
                    decided_at=now,
                    updated_at=now,
                )
            )
            if upd.rowcount == 0:
                raise ApprovalConflictError("并发冲突：该审批已被其他请求处理")

            if approved:
                # 批准：将执行记录推进为 READY，等待后台调度器原子领取
                await session.execute(
                    update(self.tool_execution_table)
                    .where(
                        and_(
                            self.tool_execution_table.c.approval_id == approval_id,
                            self.tool_execution_table.c.status == ExecutionStatus.WAITING_APPROVAL.value,
                        )
                    )
                    .values(status=ExecutionStatus.READY.value, updated_at=now)
                )
            else:
                # 拒绝：标记执行记录为 SKIPPED，并生成标准失败结果消息
                reject_msg = {
                    "role": "tool",
                    "status": "tool_called",
                    "tool_call_id": row["call_id"],
                    "content": json.dumps(
                        {
                            "success": False,
                            "error_type": "ToolApprovalRejected",
                            "error": "用户拒绝执行高危操作",
                            "reason": "user_manual",
                        },
                        ensure_ascii=False,
                    ),
                }
                await session.execute(
                    update(self.tool_execution_table)
                    .where(self.tool_execution_table.c.approval_id == approval_id)
                    .values(
                        status=ExecutionStatus.SKIPPED.value,
                        result_message_json=json.dumps(reject_msg, ensure_ascii=False),
                        error_message="用户拒绝执行高危操作",
                        finished_at=now,
                        updated_at=now,
                    )
                )

            updated_row = (
                await session.execute(
                    select(self.tool_approval_table).where(
                        self.tool_approval_table.c.approval_id == approval_id
                    )
                )
            ).mappings().first()

            return {"approval": dict(updated_row), "idempotent": False}

    # =========================================================================
    # 4. 提交新消息时自动拒绝当前会话的 PENDING 审批（设计文档 11.9 节）
    # =========================================================================
    async def auto_reject_on_new_message(
            self,
            *,
            gateway_id: str,
            tenant_id: str,
            user_id: str,
            session_id: str,
            trigger_message_id: str,
    ) -> list[dict[str, Any]]:
        """
        用户在同一会话提交新消息时，自动拒绝所有尚未处理的 PENDING 审批。
        仅作用于当前用户的当前 session_id，跨会话隔离。
        """
        now = utcnow()
        rejected_records: list[dict[str, Any]] = []

        async with self.db.session() as session:
            pending_rows = (
                await session.execute(
                    select(self.tool_approval_table).where(
                        and_(
                            self.tool_approval_table.c.gateway_id == gateway_id,
                            self.tool_approval_table.c.tenant_id == tenant_id,
                            self.tool_approval_table.c.user_id == user_id,
                            self.tool_approval_table.c.session_id == session_id,
                            self.tool_approval_table.c.status == ApprovalStatus.PENDING.value,
                        )
                    )
                )
            ).mappings().all()

            for row in pending_rows:
                upd = await session.execute(
                    update(self.tool_approval_table)
                    .where(
                        and_(
                            self.tool_approval_table.c.approval_id == row["approval_id"],
                            self.tool_approval_table.c.status == ApprovalStatus.PENDING.value,
                            self.tool_approval_table.c.version == row["version"],
                        )
                    )
                    .values(
                        status=ApprovalStatus.REJECTED.value,
                        version=row["version"] + 1,
                        decided_by="system",
                        decision_source="new_message",
                        trigger_message_id=trigger_message_id,
                        decided_at=now,
                        updated_at=now,
                    )
                )
                if upd.rowcount == 0:
                    # 已被并发人工批准抢先处理，跳过
                    continue

                reject_msg = {
                    "role": "tool",
                    "status": "tool_called",
                    "tool_call_id": row["call_id"],
                    "content": json.dumps(
                        {
                            "success": False,
                            "error_type": "ToolApprovalRejected",
                            "error": "用户提交了新消息，未处理的工具审批已自动拒绝",
                            "reason": "new_message",
                        },
                        ensure_ascii=False,
                    ),
                }
                await session.execute(
                    update(self.tool_execution_table)
                    .where(self.tool_execution_table.c.approval_id == row["approval_id"])
                    .values(
                        status=ExecutionStatus.SKIPPED.value,
                        result_message_json=json.dumps(reject_msg, ensure_ascii=False),
                        error_message="用户提交新消息自动拒绝",
                        finished_at=now,
                        updated_at=now,
                    )
                )

                # 持久化拒绝结果 SSE 事件
                await session.execute(
                    insert(self.sse_event_table).values(
                        gateway_id=gateway_id,
                        tenant_id=tenant_id,
                        user_id=user_id,
                        session_id=session_id,
                        biz_id=row["approval_id"],
                        event_type="tool_called",
                        payload_json=json.dumps(
                            {
                                "session_id": session_id,
                                "tool_call_messages": [reject_msg],
                                "last_message_event": "tool_called",
                            },
                            ensure_ascii=False,
                        ),
                        created_at=now,
                    )
                )
                rejected_records.append(dict(row))

        return rejected_records

    # =========================================================================
    # 5. 后台调度器：原子领取 READY 任务 & 结果落盘
    # =========================================================================
    async def claim_ready_execution(self, gateway_id: str, worker_id: str) -> dict[str, Any] | None:
        """
        原子领取一条 READY 状态的执行任务，置为 RUNNING。
        """
        now = utcnow()
        async with self.db.session() as session:
            candidate = (
                await session.execute(
                    select(self.tool_execution_table)
                    .where(
                        and_(
                            self.tool_execution_table.c.gateway_id == gateway_id,
                            self.tool_execution_table.c.status == ExecutionStatus.READY.value,
                        )
                    )
                    .order_by(self.tool_execution_table.c.created_at.asc())
                    .limit(1)
                )
            ).mappings().first()

            if candidate is None:
                return None

            upd = await session.execute(
                update(self.tool_execution_table)
                .where(
                    and_(
                        self.tool_execution_table.c.execution_id == candidate["execution_id"],
                        self.tool_execution_table.c.status == ExecutionStatus.READY.value,
                    )
                )
                .values(
                    status=ExecutionStatus.RUNNING.value,
                    worker_id=worker_id,
                    started_at=now,
                    updated_at=now,
                )
            )
            if upd.rowcount == 0:
                return None

            # 同时读取关联的审批/参数信息供执行前校验 args_digest
            approval = None
            if candidate["approval_id"]:
                approval = (
                    await session.execute(
                        select(self.tool_approval_table).where(
                            self.tool_approval_table.c.approval_id == candidate["approval_id"]
                        )
                    )
                ).mappings().first()

            return {
                "execution": dict(candidate),
                "approval": dict(approval) if approval else None,
            }

    async def complete_execution(
            self,
            *,
            execution_id: str,
            succeeded: bool,
            result_message: dict[str, Any],
            error_message: str | None = None,
    ) -> str | None:
        """
        保存单条工具执行结果；若同一 batch_id 下所有工具均已终态，
        则按 tool_calls 原始顺序组装消息并写入 cloud_submissions 待续传表，返回 submission_id。
        """
        now = utcnow()
        final_status = ExecutionStatus.SUCCEEDED.value if succeeded else ExecutionStatus.FAILED.value
        terminal_statuses = {
            ExecutionStatus.SUCCEEDED.value,
            ExecutionStatus.FAILED.value,
            ExecutionStatus.SKIPPED.value,
        }

        async with self.db.session() as session:
            exec_row = (
                await session.execute(
                    select(self.tool_execution_table).where(
                        self.tool_execution_table.c.execution_id == execution_id
                    )
                )
            ).mappings().first()
            if exec_row is None:
                return None

            # 1. 更新当前执行记录
            await session.execute(
                update(self.tool_execution_table)
                .where(self.tool_execution_table.c.execution_id == execution_id)
                .values(
                    status=final_status,
                    result_message_json=json.dumps(result_message, ensure_ascii=False),
                    error_message=error_message,
                    finished_at=now,
                    updated_at=now,
                )
            )

            # 2. 写入 tool_called SSE 事件
            await session.execute(
                insert(self.sse_event_table).values(
                    gateway_id=exec_row["gateway_id"],
                    tenant_id=exec_row["tenant_id"],
                    user_id=exec_row["user_id"],
                    session_id=exec_row["session_id"],
                    biz_id=exec_row["call_id"],
                    event_type="tool_called",
                    payload_json=json.dumps(
                        {
                            "session_id": exec_row["session_id"],
                            "tool_call_messages": [result_message],
                            "last_message_event": "tool_called",
                        },
                        ensure_ascii=False,
                    ),
                    created_at=now,
                )
            )

            # 3. 检查同批次所有执行是否全部完成
            batch_id = exec_row["batch_id"]
            all_execs = (
                await session.execute(
                    select(self.tool_execution_table).where(
                        self.tool_execution_table.c.batch_id == batch_id
                    )
                )
            ).mappings().all()

            if not all(e["status"] in terminal_statuses for e in all_execs):
                return None

            # 4. 全部结束：按 tool_calls 原始顺序拼接 assistant 消息 + 全部 tool 结果
            batch_row = (
                await session.execute(
                    select(self.tool_batch_table).where(self.tool_batch_table.c.batch_id == batch_id)
                )
            ).mappings().first()
            if batch_row is None:
                return None

            assistant_msg = json.loads(batch_row["assistant_message_json"])
            tool_calls = json.loads(batch_row["tool_calls_json"])
            cloud_results = json.loads(batch_row["cloud_results_json"] or "[]")

            result_by_call_id: dict[str, dict[str, Any]] = {
                m["tool_call_id"]: m for m in cloud_results if "tool_call_id" in m
            }
            for e in all_execs:
                if e["result_message_json"]:
                    result_by_call_id[e["call_id"]] = json.loads(e["result_message_json"])

            ordered_messages = [assistant_msg]
            for tc in tool_calls:
                cid = tc.get("id") or tc.get("call_id")
                if cid in result_by_call_id:
                    ordered_messages.append(result_by_call_id[cid])

            submission_id = uuid_str()
            await session.execute(
                insert(self.cloud_submission_table).values(
                    submission_id=submission_id,
                    batch_id=batch_id,
                    gateway_id=exec_row["gateway_id"],
                    tenant_id=exec_row["tenant_id"],
                    user_id=exec_row["user_id"],
                    session_id=exec_row["session_id"],
                    ordered_messages_json=json.dumps(ordered_messages, ensure_ascii=False),
                    status=SubmissionStatus.PENDING.value,
                    retry_count=0,
                    created_at=now,
                    updated_at=now,
                )
            )
            return submission_id

    # =========================================================================
    # 6. 查询接口（待审批列表 & SSE Last-Event-ID 断连事件补发）
    # =========================================================================
    async def list_approvals(
            self,
            *,
            gateway_id: str,
            tenant_id: str,
            user_id: str,
            session_id: str | None = None,
            status: ApprovalStatus | None = None,
            limit: int = 50,
            offset: int = 0,
    ) -> list[dict[str, Any]]:
        conditions = [
            self.tool_approval_table.c.gateway_id == gateway_id,
            self.tool_approval_table.c.tenant_id == tenant_id,
            self.tool_approval_table.c.user_id == user_id,
        ]
        if session_id:
            conditions.append(self.tool_approval_table.c.session_id == session_id)
        if status:
            conditions.append(self.tool_approval_table.c.status == status.value)

        stmt = (
            select(self.tool_approval_table)
            .where(and_(*conditions))
            .order_by(self.tool_approval_table.c.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        async with self.engine.connect() as session:
            rows = (await session.execute(stmt)).mappings().all()
            return [dict(r) for r in rows]

    async def replay_sse_events(
            self,
            *,
            gateway_id: str,
            tenant_id: str,
            user_id: str,
            last_event_id: int,
            session_id: str | None = None,
            limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        支持 SSE 重连后通过 Last-Event-ID 补发当前用户可见的历史持久化事件。
        """
        conditions = [
            self.sse_event_table.c.gateway_id == gateway_id,
            self.sse_event_table.c.tenant_id == tenant_id,
            self.sse_event_table.c.user_id == user_id,
            self.sse_event_table.c.event_id > last_event_id,
        ]
        if session_id:
            conditions.append(self.sse_event_table.c.session_id == session_id)

        stmt = (
            select(self.sse_event_table)
            .where(and_(*conditions))
            .order_by(self.sse_event_table.c.event_id.asc())
            .limit(limit)
        )
        async with self.engine.connect() as session:
            rows = (await session.execute(stmt)).mappings().all()
            return [dict(r) for r in rows]
