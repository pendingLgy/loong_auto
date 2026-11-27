"""工作目录持久化。"""

import json
from datetime import datetime, timezone
from typing import List

from loong_contracts.response.base import BasePageResponse
from loong_contracts.response.workspace import WorkspaceResponse
from loong_contracts.utils.datetime_util import utcnow
from sqlalchemy import func, insert, select, update

from loong_cloud import schema
from loong_cloud.core.exceptions import StorageError
from loong_cloud.db.db_proxy import AsyncDatabaseProxy
from loong_cloud.utils.snowflake import next_id


class WorkspaceStore:
    def __init__(self, db_proxy: AsyncDatabaseProxy):
        self.db = db_proxy
        self.table = schema.GLOBAL_TABLES.workspace

    async def create(self, tenant_id: int, user_id: int, name: str, path: list[str]) -> WorkspaceResponse:

        now = utcnow()
        workspace_id = next_id()
        values = {
            "id": workspace_id,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "name": name,
            "path": json.dumps(path, ensure_ascii=False),
            "is_deleted": 0,
            "created_at": now,
            "updated_at": now,
        }

        async with self.db.session() as session:
            await session.execute(insert(self.table).values(**values))

        return WorkspaceResponse(
            id=workspace_id,
            tenant_id=tenant_id,
            user_id=user_id,
            name=name,
            path=path,
            created_at=now,
            updated_at=now,
        )


    async def list_page(self, tenant_id: int, user_id: int, page: int = 1, page_size: int = 20) -> BasePageResponse[List[WorkspaceResponse]]:
        page = max(page, 1)
        page_size = max(min(page_size, 1000), 1)
        where = (
            self.table.c.tenant_id == tenant_id,
            self.table.c.user_id == user_id,
            self.table.c.is_deleted == 0,
        )

        async with self.db.session() as session:
            total = await session.scalar(select(func.count()).select_from(self.table).where(*where))
            rows = (await session.execute(
                select(self.table).where(*where).order_by(self.table.c.id.desc())
                .offset((page - 1) * page_size).limit(page_size)
            )).mappings().all()


        return BasePageResponse(rows=[WorkspaceResponse.model_validate(row) for row in rows], total=total,
                                page=page, page_size=page_size)

    async def get(self, tenant_id: int, user_id: int, workspace_id: int) -> WorkspaceResponse | None:
        where = (
            self.table.c.tenant_id == tenant_id,
            self.table.c.user_id == user_id,
            self.table.c.id == workspace_id,
            self.table.c.is_deleted == 0,
        )

        async with self.db.session() as session:
            row = (await session.execute(select(self.table).where(*where))).mappings().first()

        return WorkspaceResponse.model_validate(row) if row else None

    async def update(self, tenant_id: int, user_id: int, workspace_id: int, name: str, path: list[str]) -> WorkspaceResponse:
        values = {}
        if name is not None:
            values["name"] = name
        if path is not None:
            values["path"] = json.dumps(path, ensure_ascii=False)

        exist = await self.get(tenant_id, user_id, workspace_id)
        if exist is None:
            raise StorageError("请求参数错误")

        if values:
            values["updated_at"] = utcnow()
            where = (
                self.table.c.tenant_id == tenant_id,
                self.table.c.user_id == user_id,
                self.table.c.id == workspace_id,
                self.table.c.is_deleted == 0,
            )
            async with self.db.session() as session:
                await session.execute(update(self.table).where(*where).values(**values))

        updated = await self.get(tenant_id, user_id, workspace_id)
        if updated is None:
            raise StorageError("工作目录不存在")
        return updated

    async def delete(self, tenant_id: int, user_id: int, workspace_id: int) -> bool:
        where = (
            self.table.c.tenant_id == tenant_id,
            self.table.c.user_id == user_id,
            self.table.c.id == workspace_id,
            self.table.c.is_deleted == 0,
        )

        async with self.db.session() as session:
            result = await session.execute(
                update(self.table).where(*where).values(
                    is_deleted=1,
                    updated_at=datetime.now(timezone.utc),
                )
            )

        return (result.rowcount or 0) > 0
