"""消息与会话上下文持久化。"""
import time
from datetime import datetime, timezone
from typing import List

from sqlalchemy import insert, select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from loong_cloud import schema
from loong_cloud.agent.models import Message
from loong_cloud.db.db_proxy import AsyncDatabaseProxy
from loong_cloud.utils.snowflake import next_id
from loong_contracts.request.message import AddMessageRequest
from loong_contracts.response.base import BasePageResponse


class MessageStore:
    def __init__(self, db_proxy: AsyncDatabaseProxy):
        self.db = db_proxy
        self.message_table = schema.GLOBAL_TABLES.message
        self.session_message_table = schema.GLOBAL_TABLES.session_message

    async def _upsert_session_message(
            self,
            db_session: AsyncSession,
            session_id: str,
            tenant_id: int,
            user_id: int,
            session_title: str,
            message: list[Message],
    ) -> list[Message]:
        """追加会话消息并返回按历史顺序合并后的完整消息数组。"""
        now = datetime.now(timezone.utc)

        history = (await db_session.execute(
            select(self.session_message_table)
            .where(
                self.session_message_table.c.tenant_id == tenant_id,
                self.session_message_table.c.user_id == user_id,
                self.session_message_table.c.session_id == session_id,
                self.session_message_table.c.is_deleted == 0,
            )
        )).mappings().first()

        if history is None:
            values = {
                "id": next_id(), "tenant_id": tenant_id, "user_id": user_id,
                "session_title": session_title,
                "session_id": session_id, "version": 1,
                "message_count": len(message),
                "message_size_kb": max(1,
                                       len(str([m.model_dump(mode="json") for m in message]).encode("utf-8")) // 1024),
                "messages": [m.model_dump(mode="json") for m in message],
                "created_at": now,
            }
            await db_session.execute(insert(self.session_message_table).values(**values))
            return message

        history_messages = [Message.model_validate(item) for item in (history["messages"] or [])]
        latest_messages = [*history_messages, *message]

        serialized = [message.model_dump(mode="json") for message in latest_messages]
        await db_session.execute(
            update(self.session_message_table)
            .where(self.session_message_table.c.id == history["id"])
            .values(
                messages=serialized,
                message_count=len(latest_messages),
                message_size_kb=max(1, len(str(serialized).encode("utf-8")) // 1024),
                version=(history["version"] or 0) + 1,
            )
        )
        return latest_messages

    async def add_message(self, request: AddMessageRequest) -> list[Message] | None:
        tenant_id, user_id, session_id, session_title, message_requests = request.tenant_id, request.user_id, request.session_id, request.session_title, request.messages
        llm = request.llm

        values_list = []
        add_session_message: List[Message] = []

        for message_request in message_requests:
            async with self.db.session() as session:
                where = (self.message_table.c.tenant_id == tenant_id,
                         self.message_table.c.user_id == user_id,
                         self.message_table.c.session_id == session_id,
                         self.message_table.c.message_id == message_request.id,
                         )

                total = await session.scalar(select(func.count()).select_from(self.session_message_table).where(*where))

                if total and total > 0:
                    continue

                message_request.created = int(time.time())
                message = Message.model_validate(message_request.model_dump(mode="json"))
                add_session_message.append(message)

                value = {
                    "id": next_id(),
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "session_id": session_id,
                    "model": llm.model,
                    "message_id": message_request.id,
                    "created": message_request.created,
                    "role": message_request.role,
                    "raw": message_request.raw,
                    "finish_reason": message_request.finish_reason,
                    "status": message_request.status,
                    "input_tokens": message_request.input_tokens,
                    "output_tokens": message_request.output_tokens,
                    "total_tokens": message_request.total_tokens,
                    "content": message_request.content,
                    "tool_calls": [call.model_dump(mode="json") for call in (message_request.tool_calls or [])],
                    "tool_call_id": message_request.tool_call_id,
                }

                values_list.append(value)

        if len(values_list) == 0:
            return None

        async with self.db.session() as session:
            await session.execute(insert(self.message_table), values_list)
            return await self._upsert_session_message(session, session_id, tenant_id, user_id, session_title,
                                                      add_session_message)

    async def list_messages(self, tenant_id: int, user_id: int, session_id: str, page: int = 1,
                            page_size: int = 20) -> BasePageResponse:
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)
        where = (self.message_table.c.tenant_id == tenant_id, self.message_table.c.user_id == user_id,
                 self.message_table.c.session_id == session_id)

        async with self.db.session() as session:
            total = await session.scalar(select(func.count()).select_from(self.message_table).where(*where))
            rows = (await session.execute(
                select(self.message_table).where(*where).order_by(self.message_table.c.id.desc()).offset(
                    (page - 1) * page_size).limit(page_size))).mappings().all()

        items = [dict(row) for row in rows]
        return BasePageResponse(rows=items, total=total, page=page, page_size=page_size)

    async def list_session_messages(self, tenant_id: int, user_id: int, session_title: str | None, page: int = 1,
                                    page_size: int = 20) -> BasePageResponse:
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)
        where = (self.session_message_table.c.tenant_id == tenant_id, self.session_message_table.c.user_id == user_id,
                 self.session_message_table.c.is_deleted == 0)

        async with self.db.session() as session:
            total = await session.scalar(select(func.count()).select_from(self.session_message_table).where(*where))
            rows = (await session.execute(select(self.session_message_table).where(*where).order_by(
                self.session_message_table.c.id.desc()).offset((page - 1) * page_size).limit(
                page_size))).mappings().all()

        items = [dict(row) for row in rows]
        return BasePageResponse(rows=items, total=total, page=page, page_size=page_size)
