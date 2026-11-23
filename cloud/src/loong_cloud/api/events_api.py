"""提交对话消息，通过独立的 SSE 长连接推送执行结果。"""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import aclosing, suppress
from dataclasses import dataclass, field

import anyio
from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from loguru import logger
from starlette.types import Message as ASGIMessage
from starlette.types import Receive, Scope, Send

from core.exceptions import StorageError
from loong_cloud.agent import AgentLoop, ModelExecutor
from loong_cloud.agent.supply.supplier import ModelSupplier
from loong_cloud.agent.tools import DEFAULT_LOCAL_TOOLS
from loong_cloud.config.config_model import ModelConfig
from loong_cloud.core.logging import log_exception
from loong_cloud.storage.message_store import MessageStore
from loong_contracts.agent.models import LoopEvent, Message, ToolDefinition
from loong_contracts.common.llm_message_constant import GlobalMessageRole, GlobalMessageStatus
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest
from loong_contracts.response.login import UserInfoResponse
from loong_contracts.utils import Response
from loong_contracts.utils.datetime_util import utcnow
from loong_contracts.utils.uuid_util import uuid_str
from storage.session_store import SessionStore

router = APIRouter(prefix="/events", tags=["对话事件"])
HEARTBEAT_INTERVAL_SECONDS = 15
HEARTBEAT_SEND_TIMEOUT_SECONDS = 5
HEARTBEAT_MAX_FAILURES = 5
HEARTBEAT_BACKOFF_SECONDS = 1


@dataclass
class MessageSaveContext:
    """保存结束消息的轻量元数据，不缓存消息、工具或 API 密钥。"""

    session_title: str
    provider: str
    model: str


@dataclass
class EventSession:
    """一个客户端连接的队列及当前执行任务；队列满时等待消费。"""

    queue: asyncio.Queue[str] = field(default_factory=lambda: asyncio.Queue(maxsize=128))
    task: asyncio.Task[None] | None = None
    busy: bool = False
    connected: bool = True
    save_contexts: dict[str, MessageSaveContext] = field(default_factory=dict)

class HeartbeatStreamingResponse(StreamingResponse):
    """在实际 ASGI 发送阶段检查心跳失败，并确保连接资源释放。"""

    def __init__(self, *args, client_id:str,
                 on_stop: Callable[[LoopEvent], Awaitable[None]],
                 on_close: Callable[[], Awaitable[None]], **kwargs):
        super().__init__(*args, **kwargs)
        self.on_close = on_close
        self.client_id = client_id
        self.on_stop = on_stop
        self.stop_tasks: set[asyncio.Task[None]] = set()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        disconnected = asyncio.Event()

        async def handle_stop(event: LoopEvent) -> None:
            try:
                await self.on_stop(event)
            except Exception as e:
                log_exception(e,f"SSE on_stop 后台任务失败，client_id={self.client_id}")

        async def watch_disconnect() -> None:
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    disconnected.set()
                    logger.info("SSE 客户端已断开，直接释放会话，client_id={}", self.client_id)
                    return

        async def send_with_retry(message: ASGIMessage) -> None:
            if message["type"] != "http.response.body" or not message.get("more_body", False):
                await send(message)
                return

            # 每个队列元素是一帧 SSE；保存操作在发送重试循环外只执行一次。
            body = message.get("body", b"").decode(self.charset)
            lines = body.splitlines()
            if "event: stop" in lines:
                data = "\n".join(line[5:].lstrip() for line in lines if line.startswith("data:"))
                event = LoopEvent.model_validate_json(data)
                if not event.error:
                    task = asyncio.create_task(handle_stop(event), name=f"sse-stop:{self.client_id}")
                    self.stop_tasks.add(task)
                    task.add_done_callback(self.stop_tasks.discard)

            for attempt in range(1, HEARTBEAT_MAX_FAILURES + 1):
                try:
                    # 部分 ASGI 服务端在断连后 send 会静默返回，不能只依赖 OSError。
                    if disconnected.is_set():
                        raise ConnectionError("客户端连接已经断开")
                    await asyncio.wait_for(send(message), timeout=HEARTBEAT_SEND_TIMEOUT_SECONDS)
                    if disconnected.is_set():
                        raise ConnectionError("发送期间客户端连接断开")
                    return
                except (OSError, asyncio.TimeoutError):
                    logger.opt(exception=True).warning(
                        "SSE 消息发送失败，client_id={}，第 {}/{} 次",
                        self.client_id, attempt, HEARTBEAT_MAX_FAILURES,
                    )
                    if attempt == HEARTBEAT_MAX_FAILURES:
                        raise OSError(f"SSE 消息连续 {HEARTBEAT_MAX_FAILURES} 次发送失败，关闭连接") from None
                    delay = HEARTBEAT_BACKOFF_SECONDS * 2 ** (attempt - 1)
                    logger.info("SSE 发送退避 {} 秒，client_id={}", delay, self.client_id)
                    await asyncio.sleep(delay)

        watcher = asyncio.create_task(watch_disconnect())
        stream_task = asyncio.create_task(self.stream_response(send_with_retry))
        try:
            # 收到明确断连事件时直接取消流，包括正在等待消息或退避的任务。
            done, _ = await asyncio.wait(
                {watcher, stream_task}, return_when=asyncio.FIRST_COMPLETED,
            )
            if watcher in done:
                await watcher
            else:
                await stream_task
        except OSError:
            logger.info("SSE 连接结束，释放会话，client_id={}", self.client_id)
        finally:
            with anyio.CancelScope(shield=True):
                watcher.cancel()
                stream_task.cancel()
                try:
                    await asyncio.gather(watcher, stream_task, return_exceptions=True)
                finally:
                    try:
                        # 保存任务不随 SSE 断连取消，完成后再释放其依赖的会话数据。
                        if self.stop_tasks:
                            await asyncio.gather(*self.stop_tasks, return_exceptions=True)
                    finally:
                        try:
                            await self.on_close()
                        finally:
                            await self.body_iterator.aclose()
        if self.background is not None:
            await self.background()


def _sessions(request: Request) -> dict[tuple[str, str, str], EventSession]:
    # 状态属于应用实例，不在不同应用或测试之间共享；仅支持单 worker。
    if not hasattr(request.app.state, "event_sessions"):
        request.app.state.event_sessions = {}
    return request.app.state.event_sessions


def _session_key(request: Request, session_id: str) -> tuple[str, str, str]:
    identity = request.state.identity
    return str(identity.tenant_id), str(identity.id), session_id


async def _run_dialogue(
    channel: EventSession,
    supplier: ModelSupplier,
    tenant_id: int,
    user_id: int,
    workspace_id: int,
    client_id: str,
    session_id: str,
    messages: list[Message],
    config: ModelConfig,
    tools: list[ToolDefinition] | None,
    message_store: MessageStore,
    llm:LLMParamRequest,
) -> None:
    try:
        async with ModelExecutor(supplier=supplier) as executor:
            loop = AgentLoop(executor, config, tools, DEFAULT_LOCAL_TOOLS, session_id=session_id,client_id=client_id)
            async with aclosing(loop.run_sse(messages)) as stream:
                async for frame in stream:
                    await channel.queue.put(frame)
    except Exception as e:
        log_exception(e, f"对话 SSE 执行失败，session_id={session_id}")

        error_msg = Message(id=uuid_str(),status=GlobalMessageStatus.RUNNING, role=GlobalMessageRole.ASSISTANT, content=str(e))
        await channel.queue.put(LoopEvent(
            last_message_event=GlobalMessageStatus.RUNNING,
            client_id=client_id,
            session_id=session_id,
            error=False,
            messages=[error_msg],
        ).to_sse())

        try:
            add_message = AddMessageRequest(
                tenant_id=tenant_id,
                user_id=user_id,
                workspace_id=workspace_id,
                session_id=session_id,
                llm=llm,
                messages=[error_msg]
            )
            await message_store.add_message(add_message)
        except Exception as e:
            log_exception(e,"保存sse错误异常")
            pass

        await channel.queue.put(LoopEvent(
            last_message_event=GlobalMessageStatus.STOP,
            client_id=client_id,
            session_id=session_id,
            error=True,
            messages=None,
        ).to_sse())

    finally:
        channel.busy = False



@router.get("/chat/{client_id}/sse")
@inject
async def chat_sse(request: Request, client_id: str,
                   message_store: MessageStore = Depends(Provide["MessageStore"]),
                   session_store: SessionStore = Depends(Provide["SessionStore"]),
                   ) -> StreamingResponse:
    """先建立订阅；对话完成后保持连接，空闲时每 15 秒发送心跳。"""
    sessions = _sessions(request)
    key = _session_key(request, client_id)
    if key in sessions:
        raise HTTPException(status_code=409, detail="当前会话已有 SSE 连接")
    channel = EventSession()
    sessions[key] = channel

    async def close_session() -> None:
        channel.connected = False
        if sessions.get(key) is channel:
            logger.info(f"remove event session: {key}")
            sessions.pop(key)
        try:
            if channel.task is not None:
                channel.task.cancel()
                with suppress(asyncio.CancelledError):
                    await channel.task
        finally:
            channel.task = None
            channel.busy = False
            channel.save_contexts.clear()
            while not channel.queue.empty():
                channel.queue.get_nowait()

    async def save_stop_message(event: LoopEvent) -> None:
        context = channel.save_contexts.pop(event.session_id, None)
        if context is None or not event.messages:
            return
        final_message = event.messages[-1]
        if final_message.role != GlobalMessageRole.ASSISTANT:
            return
        # 模型响应 ID 通常是字符串，存储契约要求数值消息 ID；原始响应保留在 raw。
        try:

            exist_session = await session_store.get_by_session_id(
                tenant_id=request.state.identity.tenant_id,
                user_id=request.state.identity.id,
                session_id=event.session_id
            )

            if exist_session is None:
                raise StorageError("workspace not exist")

            saved = AddMessageRequest(
                tenant_id=request.state.identity.tenant_id,
                user_id=request.state.identity.id,
                workspace_id=exist_session.workspace_id,
                session_id=event.session_id,
                session_title=context.session_title,
                llm=LLMParamRequest(provider=context.provider, model=context.model),
                tools=[],
                messages=[final_message],
            )

            await message_store.add_message(saved)
        except Exception:
            logger.exception("保存 SSE 结束消息失败，session_id={}", event.session_id)
            raise

    async def events() -> AsyncIterator[str]:
        # 立即发出首帧，客户端收到后即可提交消息。

        loop_event = LoopEvent(last_message_event=GlobalMessageStatus.CONNECTED,client_id=client_id,time=utcnow().isoformat())
        yield loop_event.to_sse()

        # receive 由响应层独占监听；断连由发送重试流程统一结束。
        while True:
            try:
                frame = await asyncio.wait_for(
                    channel.queue.get(), timeout=HEARTBEAT_INTERVAL_SECONDS,
                )

            except asyncio.TimeoutError:

                loop_event = LoopEvent(last_message_event=GlobalMessageStatus.HEARTBEAT, client_id=client_id,
                                       time=utcnow().isoformat())

                yield loop_event.to_sse()
            else:
                yield frame

    return HeartbeatStreamingResponse(
        events(),
        client_id=client_id,
        on_stop=save_stop_message,
        on_close=close_session,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat/{client_id}/messages/{session_id}")
@inject
async def submit_message(
    request: Request,
    client_id: str,
    session_id: str,
    body: AddMessageRequest,
    message_store: MessageStore = Depends(Provide["MessageStore"]),
):
    """保存消息后启动对话任务，结果通过已建立的 SSE 连接推送。"""

    supplier = request.app.state.supplier
    identity:UserInfoResponse = request.state.identity
    workspace_id = body.workspace_id
    llm = body.llm

    channel = _sessions(request).get(_session_key(request, client_id))
    if channel is None or not channel.connected:
        raise HTTPException(status_code=409, detail="请先建立当前会话的 SSE 连接")
    if channel.busy:
        raise HTTPException(status_code=409, detail="当前会话正在执行，请等待完成后再提交")


    # 在首次 await 前占用会话，避免并发请求重复启动任务。
    channel.busy = True
    try:
        body.tenant_id = request.state.identity.tenant_id
        body.user_id = request.state.identity.id

        config = ModelConfig(
            provider=body.llm.provider,
            model=body.llm.model,
            temperature=body.llm.temperature,
            api_key=body.llm.api_key,
        )
        tools = body.tools
        messages = await message_store.add_message(body)
        if messages is None:
            channel.busy = False
            return Response.fail(request, code=409, msg="not new message")
        if not channel.connected:
            raise HTTPException(status_code=409, detail="SSE 连接已断开，消息已保存但未开始执行")
        channel.save_contexts[session_id] = MessageSaveContext(
            session_title=body.session_title,
            provider=body.llm.provider,
            model=body.llm.model,
        )
        channel.task = asyncio.create_task(
            _run_dialogue(channel=channel,supplier=supplier,
                          tenant_id=identity.tenant_id,
                          user_id=identity.id,
                          workspace_id=workspace_id,
                          client_id=client_id,
                          session_id=session_id,
                          messages=messages,
                          config=config,
                          tools=tools,
                          message_store=message_store,
                          llm=llm),
            name=f"dialogue:{session_id}",
        )
    except BaseException:
        channel.busy = False
        raise

    return Response.ok(request, msg="消息已提交")
