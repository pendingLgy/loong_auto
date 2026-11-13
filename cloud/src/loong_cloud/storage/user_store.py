"""用户持久化；密码哈希在工作线程执行，避免阻塞事件循环。"""

import asyncio
import hashlib
import hmac
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError
from starlette import status

from loong_cloud.db.db_proxy import AsyncDatabaseProxy
from loong_cloud import schema
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
        self.user_table = schema.GLOBAL_TABLES.user
        self.login_log_table = schema.GLOBAL_TABLES.login_log
        self._dummy_hash = secrets.token_hex(32)


    async def _record_login_log(
        self, tenant_id: int, user_id: int | None, username: str,
        success: bool, msg: str, ip: str | None, user_agent: str | None,
    ) -> None:
        """独立事务保存认证操作，不记录密码或令牌。"""
        async with self.db.session() as session:
            await session.execute(insert(self.login_log_table).values(
                id=next_id(), tenant_id=tenant_id, user_id=user_id,
                username=username, status=int(success), msg=msg,
                ip=ip[:64] if ip else None,
                user_agent=user_agent[:512] if user_agent else None,
                login_time=datetime.now(timezone.utc),
            ))

    async def register(self, tenant_id: int, username: str, password: str, name: str | None = None) -> UserInfoResponse:
        password_hash = await asyncio.to_thread(hash_password, password)
        now = datetime.now(timezone.utc)

        values = dict(id=next_id(), tenant_id=tenant_id, username=username,
                      password_hash=password_hash, name=name, role="user", created_at=now, updated_at=now)
        try:
            async with self.db.session() as session:
                existing = await session.scalar(
                    select(self.user_table.c.id).
                    where(
                        self.user_table.c.tenant_id == tenant_id,
                        self.user_table.c.username == username)
                )

                if existing is not None:
                    raise HTTPException(status.HTTP_409_CONFLICT, "用户名已存在")
                await session.execute(insert(self.user_table).values(**values))
        except IntegrityError as exc:
            raise HTTPException(status.HTTP_409_CONFLICT, "用户名已存在") from exc
        return UserInfoResponse.model_validate(values)

    async def login(
        self, tenant_id: int, username: str, password: str, *,
        ip: str | None = None, user_agent: str | None = None,
    ) -> UserInfoResponse:
        async with self.db.session() as session:
            row = (await session.execute(
                select(self.user_table).
                where(
                    self.user_table.c.tenant_id == tenant_id,
                    self.user_table.c.username == username
                ))).mappings().first()

        password_hash = row["password_hash"] if row and row["password_hash"] else self._dummy_hash
        valid = await asyncio.to_thread(verify_password, password, password_hash)

        if not valid or row is None or row["status"] != 1 or row["is_deleted"]:
            await self._record_login_log(
                tenant_id, row["id"] if row else None, username,
                False, "登录失败：用户名或密码错误，或用户不可用", ip, user_agent,
            )
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")

        await self._record_login_log(
            tenant_id, row["id"], username, True, "登录成功", ip, user_agent,
        )
        return UserInfoResponse.model_validate(dict(row))

    async def logout(
        self, user: UserInfoResponse, *,
        ip: str | None = None, user_agent: str | None = None,
    ) -> None:
        """令牌撤销完成后记录退出事件。"""
        await self._record_login_log(
            user.tenant_id, user.id, user.username, True, "退出登录", ip, user_agent,
        )

    async def get_user_info(self, tenant_id: int, user_id: int) -> UserInfoResponse:
        async with self.db.session() as session:
            row = (await session.execute(
                select(self.user_table).
                where(
                    self.user_table.c.id == user_id,
                    self.user_table.c.tenant_id == tenant_id,
                    self.user_table.c.status == 1,
                    self.user_table.c.is_deleted == 0)
            )).mappings().first()

        if row is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户不存在或已禁用")
        return UserInfoResponse.model_validate(dict(row))
