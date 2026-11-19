"""会话级工具配置持久化：放行策略与允许的工作目录列表。"""
import json
from pathlib import Path
from typing import Sequence

from sqlalchemy import delete, insert, select, update

from loong_contracts.utis.datetime_util import utcnow
from loong_local import schema
from loong_local.db import AsyncSqliteDB
from loong_local.schema.model import SessionConfigModel
from loong_local.tools.security import WorkspaceMode, WorkspacePolicy


class SessionConfigService:
    """读写 session_configs：每个 session_id 一条记录。"""

    def __init__(self, db: AsyncSqliteDB):
        self.db = db
        self.session_configs_table = schema.GLOBAL_TABLES.session_configs_table

    # ------------------------------------------------------------------ 查询
    async def get(self, session_id: str) -> SessionConfigModel | None:
        async with self.db.session() as session:
            row = (await session.execute(
                select(self.session_configs_table).where(
                    self.session_configs_table.c.session_id == session_id)
            )).mappings().first()
        return self._to_model(row) if row else None

    async def list_sessions(self, limit: int = 100) -> list[SessionConfigModel]:
        async with self.db.session() as session:
            rows = (await session.execute(
                select(self.session_configs_table)
                .order_by(self.session_configs_table.c.updated_at.desc())
                .limit(limit)
            )).mappings().all()
        return [self._to_model(row) for row in rows]

    # ------------------------------------------------------------------ 写入
    async def save(
            self,
            session_id: str,
            *,
            policy_model: WorkspaceMode,
            workspaces: Sequence[str | Path],
    ) -> SessionConfigModel:
        if not session_id:
            raise ValueError("session_id 不能为空")

        now = utcnow()
        workspaces_json = json.dumps([str(Path(workspace)) for workspace in workspaces],
                                     ensure_ascii=False)

        # 表以自增 id 为主键，同一 session 先查后写；写锁保证单写者，不会插入重复记录。
        async with self.db.session(write=True) as session:
            existing = (await session.execute(
                select(self.session_configs_table.c.id, self.session_configs_table.c.created_at)
                .where(self.session_configs_table.c.session_id == session_id)
            )).mappings().first()

            if existing is None:
                created_at = now
                await session.execute(
                    insert(self.session_configs_table).values(
                        session_id=session_id,
                        workspace_mode=policy_model.value,
                        workspaces=workspaces_json,
                        created_at=now,
                        updated_at=now,
                    )
                )
            else:
                created_at = existing["created_at"]
                await session.execute(
                    update(self.session_configs_table)
                    .where(self.session_configs_table.c.id == existing["id"])
                    .values(workspace_mode=policy_model.value,
                            workspaces=workspaces_json,
                            updated_at=now)
                )

        return SessionConfigModel(
            session_id=session_id,
            workspace_mode=policy_model.value,
            workspaces=[str(Path(workspace)) for workspace in workspaces],
            created_at=now,
            updated_at=now,
        )

    async def delete(self, session_id: str) -> bool:
        async with self.db.session(write=True) as session:
            result = await session.execute(
                delete(self.session_configs_table).where(
                    self.session_configs_table.c.session_id == session_id)
            )
        return bool(result.rowcount)

    # -------------------------------------------------------------- 领域转换
    @staticmethod
    def to_policy(config: SessionConfigModel) -> WorkspacePolicy:
        return WorkspacePolicy(mode=WorkspaceMode(config.workspace_mode))

    @staticmethod
    def to_workspaces(config: SessionConfigModel) -> list[Path]:
        return [Path(path) for path in config.workspaces]

    # ------------------------------------------------------------------ 内部
    @staticmethod
    def _to_model(row) -> SessionConfigModel:
        data = dict(row)
        raw = data.get("workspaces") or "[]"
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = []
        data["workspaces"] = [str(item) for item in parsed] if isinstance(parsed, list) else []
        return SessionConfigModel.model_validate(data)
