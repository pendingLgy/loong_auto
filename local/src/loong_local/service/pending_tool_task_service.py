"""工具挂起任务持久化服务。"""
import json
from typing import Optional, Dict, Any

from sqlalchemy import select, update, delete, text

from loong_contracts.common.tool_constant import ToolTaskStatus
from loong_contracts.utis.datetime_util import utcnow
from loong_local import schema
from loong_local.db import AsyncSqliteDB
from loong_local.schema.model import PendingToolTaskModel


class PendingToolTaskService:
    def __init__(self, db: AsyncSqliteDB):
        self.db = db
        self.pending_tool_tasks_table = schema.GLOBAL_TABLES.pending_tool_tasks_table

    async def save_pending_task(
            self,
            tool_id: str,
            session_id: str,
            tool_name: str,
            request_data: Dict[str, Any],
            summary: str,
            risk_reason: Optional[str] = None
    ) -> None:
        request_json = json.dumps(request_data, ensure_ascii=False)
        now = utcnow()

        async with self.db.session(write=True) as session:
            # 2. 查询是否存在 (session_id, tool_id)
            stmt = select(self.pending_tool_tasks_table).where(
                (self.pending_tool_tasks_table.c.session_id == session_id) &
                (self.pending_tool_tasks_table.c.tool_id == tool_id)
            )
            result = await session.execute(stmt)
            existing = result.first()

            if existing:
                # 3. 存在则更新
                update_stmt = (
                    update(self.pending_tool_tasks_table)
                    .where(
                        (self.pending_tool_tasks_table.c.session_id == session_id) &
                        (self.pending_tool_tasks_table.c.tool_id == tool_id)
                    )
                    .values(
                        tool_name=tool_name,
                        request_data=request_json,
                        summary=summary,
                        risk_reason=risk_reason or "",
                        status=ToolTaskStatus.PENDING.value,
                        updated_at=now
                    )
                )
                await session.execute(update_stmt)
            else:
                # 4. 不存在则插入
                insert_stmt = self.pending_tool_tasks_table.insert().values(
                    tool_id=tool_id,
                    session_id=session_id,
                    tool_name=tool_name,
                    request_data=request_json,
                    summary=summary,
                    risk_reason=risk_reason or "",
                    status=ToolTaskStatus.PENDING.value,
                    created_at=now,
                    updated_at=now
                )
                await session.execute(insert_stmt)



    async def get_task(self, session_id: str, tool_id: str) -> Optional[PendingToolTaskModel]:
        """
        根据 tool_id 获取挂起任务的详细数据（用于恢复执行）。
        返回包含反序列化后 request_data 的字典。
        """
        async with self.db.session() as session:
            stmt = select(self.pending_tool_tasks_table).where(self.pending_tool_tasks_table.c.session_id == session_id,
                                                               self.pending_tool_tasks_table.c.tool_id == tool_id)
            result = await session.execute(stmt)
            row = result.mappings().first()

            if not row:
                return None

            return PendingToolTaskModel.model_validate(row)

    async def update_status(self, session_id: str, tool_id: str, status: ToolTaskStatus) -> None:
        """
        更新任务状态（例如：approved, rejected, failed 等）
        """

        async with self.db.session(write=True) as session:
            stmt = (
                update(self.pending_tool_tasks_table)
                .where(self.pending_tool_tasks_table.c.session_id == session_id,
                       self.pending_tool_tasks_table.c.tool_id == tool_id)
                .values(status=status, updated_at=utcnow())
            )
            await session.execute(stmt)

    async def remove_task(self, session_id: str, tool_id: str) -> None:
        """
        工具执行完成或被拒绝后，清理挂起任务记录。
        """
        async with self.db.session(write=True) as session:
            stmt = delete(self.pending_tool_tasks_table).where(self.pending_tool_tasks_table.c.session_id == session_id,
                                                               self.pending_tool_tasks_table.c.tool_id == tool_id)
            await session.execute(stmt)
