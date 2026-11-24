"""消息与会话上下文持久化。"""
import time
from typing import List

from loong_contracts.agent.models import Message, ToolDetail
from loong_contracts.request.message import AddMessageRequest
from loong_contracts.response.base import BasePageResponse
from loong_contracts.response.message import RawMessageResponse
from loong_contracts.response.session import SessionSimpleResponse
from loong_contracts.utils.datetime_util import utcnow
from sqlalchemy import func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from loong_cloud import schema
from loong_cloud.core.exceptions import StorageError
from loong_cloud.db.db_proxy import AsyncDatabaseProxy
from loong_cloud.utils.snowflake import next_id


class MessageStore:
    def __init__(self, db_proxy: AsyncDatabaseProxy):
        self.db = db_proxy
        self.message_table = schema.GLOBAL_TABLES.message
        self.session_message_table = schema.GLOBAL_TABLES.session_message
        self.workspace_table = schema.GLOBAL_TABLES.workspace

    async def _upsert_session_message(
        self,
        db_session: AsyncSession,
        session_id: str,
        tenant_id: int,
        user_id: int,
        message: list[Message],
        workspace_id: int,
    ) -> list[Message]:
        """追加会话消息并返回按历史顺序合并后的完整消息数组。"""

        history = (await db_session.execute(
            select(self.session_message_table)
            .where(
                self.session_message_table.c.tenant_id == tenant_id,
                self.session_message_table.c.user_id == user_id,
                self.session_message_table.c.session_id == session_id,
                self.session_message_table.c.workspace_id == workspace_id,
                self.session_message_table.c.is_deleted == 0,
            )
        )).mappings().first()

        history_messages = [Message.model_validate(item) for item in (history["messages"] or [])]
        latest_messages = [*history_messages, *message]

        serialized = [message.model_dump(mode="json") for message in latest_messages]
        values = {
            "messages": serialized,
            "message_count": len(latest_messages),
            "message_size_kb": max(1, len(str(serialized).encode("utf-8")) // 1024),
            "version": (history["version"] or 0) + 1,
        }

        await db_session.execute(
            update(self.session_message_table)
            .where(self.session_message_table.c.id == history["id"])
            .values(**values)
        )
        return latest_messages

    async def add_message(self, request: AddMessageRequest, *,tool_detail: ToolDetail | None = None) -> list[Message] | None:
        tenant_id = request.tenant_id
        user_id = request.user_id
        session_id = request.session_id
        message_requests = request.messages

        llm = request.llm

        workspace_id = request.workspace_id

        values_list = []
        add_session_message: List[Message] = []

        for message_request in message_requests:
            async with self.db.session() as session:

                workspace_total = await session.scalar(
                    select(func.count()).select_from(self.workspace_table)
                    .where(self.workspace_table.c.tenant_id == tenant_id,
                           self.workspace_table.c.user_id == user_id,
                           self.workspace_table.c.id == workspace_id,
                           self.workspace_table.c.is_deleted == 0))
                if workspace_total != 1:
                    raise StorageError("工作目录为空")

                session_total = await session.scalar(
                    select(func.count()).select_from(self.session_message_table)
                    .where(self.session_message_table.c.tenant_id == tenant_id,
                           self.session_message_table.c.user_id == user_id,
                           self.session_message_table.c.session_id == session_id,
                           self.session_message_table.c.is_deleted == 0))
                if session_total != 1:
                    raise StorageError("会话为空")

                where = (self.message_table.c.tenant_id == tenant_id,
                         self.message_table.c.user_id == user_id,
                         self.message_table.c.session_id == session_id,
                         self.message_table.c.message_id == message_request.id,
                         )

                total = await session.scalar(
                    select(func.count()).select_from(self.message_table).where(*where))

                if total and total > 0:
                    continue

                message_request.created = int(time.time())
                message = message_request
                serialized_message = message.model_dump(mode="json")
                add_session_message.append(message)

                tool_detail_json = tool_detail.model_dump(mode="json",) if tool_detail else {}

                value = {
                    "id": next_id(),
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "session_id": session_id,
                    "model": llm.model,
                    "message_id": message_request.id,
                    "created": message_request.created,
                    "role": serialized_message["role"],
                    "raw": serialized_message["raw"],
                    "finish_reason": message_request.finish_reason,
                    "status": serialized_message["status"],
                    "input_tokens": message_request.input_tokens,
                    "output_tokens": message_request.output_tokens,
                    "total_tokens": message_request.total_tokens,
                    "content": message_request.content,
                    "tool_calls": serialized_message["tool_calls"] or None,
                    "tool_call_id": message_request.tool_call_id,
                    "tool_call_messages": tool_detail_json.get("tool_call_messages",None),
                    "remote_tool_calls": tool_detail_json.get("remote_tool_calls",None),
                    "created_at": utcnow(),
                }



                values_list.append(value)

        if len(values_list) == 0:
            return None

        async with self.db.session() as session:
            await session.execute(insert(self.message_table), values_list)
            return await self._upsert_session_message(session, session_id, tenant_id, user_id,
                                                      add_session_message, workspace_id)

    async def list_messages(self, tenant_id: int, user_id: int, session_id: str, page: int = 1,
                            page_size: int = 20) -> BasePageResponse:
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)
        where = (self.message_table.c.tenant_id == tenant_id,
                 self.message_table.c.user_id == user_id,
                 self.message_table.c.session_id == session_id)

        async with self.db.session() as session:
            total = await session.scalar(
                select(func.count()).select_from(self.message_table).where(*where))
            rows = (await session.execute(
                select(self.message_table).where(*where).order_by(
                    self.message_table.c.id.desc()).offset(
                    (page - 1) * page_size).limit(page_size))).mappings().all()

        items = [RawMessageResponse.model_validate(row) for row in rows]
        return BasePageResponse(rows=items, total=total, page=page, page_size=page_size)

    async def list_session_messages(self, tenant_id: int, user_id: int,
                                    working_directory_id: int | None = None, page: int = 1,
                                    page_size: int = 20) -> BasePageResponse:
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)
        conditions = [
            self.session_message_table.c.tenant_id == tenant_id,
            self.session_message_table.c.user_id == user_id,
            self.session_message_table.c.is_deleted == 0,
        ]
        if working_directory_id is not None:
            conditions.append(
                self.session_message_table.c.working_directory_id == working_directory_id)

        async with self.db.session() as session:
            total = await session.scalar(
                select(func.count()).select_from(self.session_message_table).where(*conditions))
            rows = (await session.execute(
                select(self.session_message_table).where(*conditions).order_by(
                    self.session_message_table.c.id.desc()).offset((page - 1) * page_size).limit(
                    page_size))).mappings().all()

        items = [SessionSimpleResponse.model_validate(row) for row in rows]
        return BasePageResponse(rows=items, total=total, page=page, page_size=page_size)
