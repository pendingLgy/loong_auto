"""会话持久化。"""

from loong_contracts.response.base import BasePageResponse
from loong_contracts.response.session import SessionSimpleResponse
from loong_contracts.utils.datetime_util import utcnow
from sqlalchemy import func, insert, select, update
from sqlalchemy.exc import IntegrityError

from loong_cloud import schema
from loong_cloud.core.exceptions import StorageError
from loong_cloud.db.db_proxy import AsyncDatabaseProxy
from loong_cloud.utils.snowflake import next_id


class SessionStore:
    def __init__(self, db_proxy: AsyncDatabaseProxy):
        self.db = db_proxy
        self.table = schema.GLOBAL_TABLES.session_message
        self.workspace_table = schema.GLOBAL_TABLES.workspace

    def _simple_select(self):
        """只查询会话概要字段，不读取 context_summary / messages 等大字段。"""
        table = self.table
        return select(
            table.c.id,
            table.c.tenant_id,
            table.c.user_id,
            table.c.session_id,
            table.c.session_title,
            table.c.workspace_id,
            table.c.created_at,
        )

    @staticmethod
    def _to_response(row) -> SessionSimpleResponse:
        return SessionSimpleResponse(
            id=row["id"],
            tenant_id=row["tenant_id"],
            user_id=row["user_id"],
            session_id=row["session_id"],
            session_title=row["session_title"],
            workspace_id=row["workspace_id"],
            created_at=row["created_at"],
        )

    async def _ensure_workspace(self, session, tenant_id: int, user_id: int,
                                workspace_id: int) -> None:
        total = await session.scalar(
            select(func.count()).select_from(self.workspace_table).where(
                self.workspace_table.c.tenant_id == tenant_id,
                self.workspace_table.c.user_id == user_id,
                self.workspace_table.c.id == workspace_id,
                self.workspace_table.c.is_deleted == 0,
            )
        )
        if total != 1:
            raise StorageError("工作目录不存在")

    async def _ensure_session(self, session, tenant_id: int, user_id: int, session_id: str) -> None:
        total = await session.scalar(
            select(func.count()).select_from(self.table).where(
                self.table.c.tenant_id == tenant_id,
                self.table.c.user_id == user_id,
                self.table.c.session_id == session_id,
                self.table.c.is_deleted == 0,
            )
        )
        if total != 1:
            raise StorageError("会话不存在")

    async def create(
        self,
        tenant_id: int,
        user_id: int,
        session_id: str,
        session_title: str,
        workspace_id: int,
    ) -> SessionSimpleResponse:
        """新增会话。"""
        now = utcnow()
        async with self.db.session() as session:
            await self._ensure_workspace(session, tenant_id, user_id, workspace_id)

            values = {
                "id": next_id(),
                "tenant_id": tenant_id,
                "user_id": user_id,
                "session_id": session_id,
                "session_title": session_title,
                "workspace_id": workspace_id,
                "version": 1,
                "message_count": 0,
                "message_size_kb": 0,
                "messages": [],
                "context_compressed": 0,
                "is_archived": 0,
                "is_deleted": 0,
                "created_at": now,
            }
            try:
                await session.execute(insert(self.table).values(**values))
            except IntegrityError as exc:
                raise StorageError("会话已存在") from exc

        result = await self.get(tenant_id, user_id, session_id,workspace_id)
        if result is None:
            raise StorageError("创建会话失败")
        return result

    async def update(
        self,
        tenant_id: int,
        user_id: int,
        workspace_id: int,
        session_id: str,
        session_title: str | None = None,
    ) -> SessionSimpleResponse:
        """编辑会话标题或所属工作目录。"""

        result = await self.get(tenant_id, user_id, session_id,workspace_id)
        if result is None:
            raise StorageError("会话不存在")

        values = {}
        if session_title is not None:
            values["session_title"] = session_title

        async with self.db.session() as session:
            await self._ensure_session(session, tenant_id, user_id, session_id)

            if values:
                await session.execute(
                    update(self.table).where(
                        self.table.c.tenant_id == tenant_id,
                        self.table.c.user_id == user_id,
                        self.table.c.session_id == session_id,
                        self.table.c.is_deleted == 0,
                    ).values(**values)
                )

        result = await self.get(tenant_id, user_id, session_id, workspace_id)
        if result is None:
            raise StorageError("创建会话失败")
        return result

    async def get(self, tenant_id: int, user_id: int,
                  session_id: str, workspace_id: int) -> SessionSimpleResponse | None:
        """查看会话详情，不查询 context_summary 字段。"""
        async with self.db.session() as session:
            row = (await session.execute(
                self._simple_select().where(
                    self.table.c.tenant_id == tenant_id,
                    self.table.c.user_id == user_id,
                    self.table.c.workspace_id == workspace_id,
                    self.table.c.session_id == session_id,
                    self.table.c.is_deleted == 0,
                )
            )).mappings().first()

        return self._to_response(row) if row else None

    async def get_by_session_id(self, tenant_id: int, user_id: int,
                  session_id: str) -> SessionSimpleResponse | None:
        """查看会话详情，不查询 context_summary 字段。"""
        async with self.db.session() as session:
            row = (await session.execute(
                self._simple_select().where(
                    self.table.c.tenant_id == tenant_id,
                    self.table.c.user_id == user_id,
                    self.table.c.session_id == session_id,
                    self.table.c.is_deleted == 0,
                )
            )).mappings().first()

        return self._to_response(row) if row else None

    async def detail(self, tenant_id: int, user_id: int,
                     session_id: str) -> SessionSimpleResponse | None:
        """查看会话详情（get 的语义化别名）。"""
        return await self.get(tenant_id, user_id, session_id)

    async def page(
        self,
        tenant_id: int,
        user_id: int,
        workspace_id: int | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> BasePageResponse[list[SessionSimpleResponse]]:
        """分页查看会话，可按工作目录过滤。"""
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)

        conditions = [
            self.table.c.tenant_id == tenant_id,
            self.table.c.user_id == user_id,
            self.table.c.is_deleted == 0,
        ]
        if workspace_id is not None:
            conditions.append(self.table.c.workspace_id == workspace_id)

        async with self.db.session() as session:
            total = await session.scalar(
                select(func.count()).select_from(self.table).where(*conditions))
            rows = (await session.execute(
                self._simple_select().where(*conditions).order_by(self.table.c.id.desc())
                .offset((page - 1) * page_size).limit(page_size)
            )).mappings().all()

        return BasePageResponse(
            rows=[self._to_response(row) for row in rows],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def list(
        self,
        tenant_id: int,
        user_id: int,
        workspace_id: int | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> BasePageResponse[list[SessionSimpleResponse]]:
        """分页查看会话（page 的别名）。"""
        return await self.page(tenant_id, user_id, workspace_id, page, page_size)
