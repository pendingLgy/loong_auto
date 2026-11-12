"""用户持久化；密码哈希在工作线程执行，避免阻塞事件循环。"""

import asyncio
import hashlib
import hmac
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import MetaData, insert, select
from sqlalchemy.exc import IntegrityError

from loong_cloud.db.db_proxy import AsyncDatabaseProxy
from loong_cloud.schema.user import user_table
from loong_cloud.utils.snowflake import next_id
from loong_contracts.response.login import UserInfoResponse


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600000).hex()
    return f"pbkdf2_sha256$600000${salt}${digest}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt, digest = encoded.split("$")
        if algorithm != "pbkdf2_sha256" or iterations != "600000":
            return False
        actual = hash_password(password, salt).rsplit("$", 1)[1]
        return hmac.compare_digest(actual, digest)
    except (ValueError, TypeError):
        return False


class UserStore:
    def __init__(self, db_proxy: AsyncDatabaseProxy):
        self.db = db_proxy
        self.table = user_table(MetaData(), db_proxy.config.sqlite.table_prefix)
        self._dummy_hash = secrets.token_hex(32)

    async def register(self, tenant_id: int, username: str, password: str, name: str | None = None) -> UserInfoResponse:
        password_hash = await asyncio.to_thread(hash_password, password)
        now = datetime.now(timezone.utc)

        values = dict(id=next_id(), tenant_id=tenant_id, username=username,
                      password_hash=password_hash, name=name, role="user", created_at=now, updated_at=now)
        try:
            async with self.db.session() as session:
                existing = await session.scalar(
                    select(self.table.c.id).
                    where(
                        self.table.c.tenant_id == tenant_id,
                        self.table.c.username == username)
                )

                if existing is not None:
                    raise HTTPException(409, "用户名已存在")
                await session.execute(insert(self.table).values(**values))
        except IntegrityError as exc:
            raise HTTPException(409, "用户名已存在") from exc
        return UserInfoResponse.model_validate(values)

    async def login(self, tenant_id: int, username: str, password: str) -> UserInfoResponse:
        async with self.db.session() as session:
            row = (await session.execute(
                select(self.table).
                where(
                    self.table.c.tenant_id == tenant_id,
                    self.table.c.username == username
                ))).mappings().first()

        password_hash = row["password_hash"] if row and row["password_hash"] else self._dummy_hash
        valid = await asyncio.to_thread(verify_password, password, password_hash)

        if not valid or row is None or row["status"] != 1 or row["is_deleted"]:
            raise HTTPException(401, "用户名或密码错误")
        return UserInfoResponse.model_validate(dict(row))

    async def get_user_info(self, tenant_id: int, user_id: int) -> UserInfoResponse:
        async with self.db.session() as session:
            row = (await session.execute(
                select(self.table).
                where(
                    self.table.c.id == user_id,
                    self.table.c.tenant_id == tenant_id,
                    self.table.c.status == tenant_id,
                    self.table.c.is_deleted == 0)
            )).mappings().first()

        if row is None:
            raise HTTPException(401, "用户不存在或已禁用")
        return UserInfoResponse.model_validate(dict(row))
