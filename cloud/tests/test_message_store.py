"""使用真实文件 SQLite 验证消息存储，无需模型密钥。"""
from tempfile import TemporaryDirectory
from pathlib import Path

import pytest
from sqlalchemy import select, update

from loong_cloud import schema
from loong_cloud.config.config_db import DatabaseConfig, SqliteConfig
from loong_cloud.db.db_proxy import AsyncDatabaseProxy
from loong_cloud.storage.message_store import MessageStore
from loong_contracts.common import Message
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest, MessageRequest


@pytest.fixture
async def store():
    schema.load_tables("test_")
    # 文件位于工作区，关闭连接池后立即删除，避免 Windows 文件占用。
    with TemporaryDirectory(prefix="message-store-", dir=Path(__file__).parent) as directory:
        proxy = AsyncDatabaseProxy(DatabaseConfig(sqlite=SqliteConfig(database=str(Path(directory) / "messages.db"))))
        try:
            await proxy.start_proxy()
            yield MessageStore(proxy)
        finally:
            if proxy.status:
                await proxy.close_db()


def make_request(message_id: int, *, tenant_id: int = 1, user_id: int = 10,
                 session_id: str = "session-1") -> AddMessageRequest:
    return AddMessageRequest(
        tenant_id=tenant_id, user_id=user_id, session_id=session_id,
        session_title="测试会话", llm=LLMParamRequest(model="deepseek-chat"), tools=[],
        messages=[MessageRequest(id=message_id, role="user", content=f"消息 {message_id}")],
    )


async def test_add_message_and_append_history(store):
    first = await store.add_message(make_request(101))
    second = await store.add_message(make_request(102))
    assert all(isinstance(message, Message) for message in second)
    assert [message.content for message in first] == ["消息 101"]
    assert [message.content for message in second] == ["消息 101", "消息 102"]
    async with store.db.session() as session:
        row = (await session.execute(select(store.session_message_table))).mappings().one()
    assert row["message_count"] == 2
    assert row["version"] == 2
    assert row["session_title"] == "测试会话"
    assert [message["content"] for message in row["messages"]] == ["消息 101", "消息 102"]


async def test_duplicate_message_is_not_appended(store):
    request = make_request(101)
    await store.add_message(request)
    assert await store.add_message(request) is None
    page = await store.list_messages(1, 10, "session-1")
    assert page.total == 1


async def test_message_pagination_and_identity_isolation(store):
    for message_id in (101, 102, 103):
        await store.add_message(make_request(message_id))
    await store.add_message(make_request(104, tenant_id=2))
    await store.add_message(make_request(105, user_id=20))
    await store.add_message(make_request(106, session_id="other"))
    first = await store.list_messages(1, 10, "session-1", page=1, page_size=2)
    second = await store.list_messages(1, 10, "session-1", page=2, page_size=2)
    assert first.total == second.total == 3
    assert [row["content"] for row in first.rows] == ["消息 103", "消息 102"]
    assert [row["content"] for row in second.rows] == ["消息 101"]


async def test_session_pagination_excludes_deleted_and_other_users(store):
    for message_id, session_id in enumerate(("first", "second", "deleted"), start=101):
        await store.add_message(make_request(message_id, session_id=session_id))
    await store.add_message(make_request(201, user_id=20))
    await store.add_message(make_request(202, tenant_id=2))
    async with store.db.session() as session:
        await session.execute(update(store.session_message_table).where(
            store.session_message_table.c.session_id == "deleted"
        ).values(is_deleted=1))
    first = await store.list_session_messages(1, 10, None, page=1, page_size=1)
    second = await store.list_session_messages(1, 10, None, page=2, page_size=1)
    assert first.total == second.total == 2
    assert first.rows[0]["session_id"] == "second"
    assert second.rows[0]["session_id"] == "first"
