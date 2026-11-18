"""聊天与消息查询接口。"""
import time

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from loong_cloud.agent import ModelExecutor, AgentLoop
from loong_cloud.agent.tools import DEFAULT_LOCAL_TOOLS
from loong_contracts.utis import Response
from loong_cloud.config.config_model import ModelConfig
from loong_cloud.storage.message_store import MessageStore
from loong_contracts.agent.models import Message, ToolDefinition, LoopEvent
from loong_contracts.common.llm_message_constant import GlobalMessageRole, GlobalMessageStatus
from loong_contracts.request.message import AddMessageRequest
from loong_contracts.utis import uuid_util
from loong_contracts.utis.response import PageResponse

router = APIRouter(prefix="/messages", tags=["消息与聊天"])


@router.post("/chat/{client_id}/session/{session_id}/complete")
@inject
async def chat_complete(request: Request,
                        client_id:str,
                        session_id: str, body: AddMessageRequest,
                        message_store: MessageStore = Depends(Provide["MessageStore"])
                        ):
    body.session_id = session_id
    body.tenant_id = request.state.tenant_id
    body.user_id = request.state.identity.id

    llm_messages: list[Message] | None = await message_store.add_message(body)

    if llm_messages is None:
        return Response.fail(request, msg="nmessage is not new")

    llm = body.llm
    config = ModelConfig(provider=llm.provider, model=llm.model, temperature=llm.temperature, api_key=llm.api_key)

    param_tools = body.tools
    tools: list[ToolDefinition] = [
        ToolDefinition(
            name=tool.name,
            description=tool.description,
            parameters=tool.parameters,
            location=tool.location,
        )
        for tool in param_tools
    ]

    async with ModelExecutor() as executor:
        event: LoopEvent = await AgentLoop(executor, config, tools, DEFAULT_LOCAL_TOOLS, session_id=session_id, client_id=client_id).run(llm_messages)

    return Response.ok(request, event)


@router.post("/chat/{client_id}/session/{session_id}/sse")
@inject
async def chat_sse(request: Request,
                   client_id: str,
                   session_id: str, body: AddMessageRequest,
                   message_store: MessageStore = Depends(Provide["MessageStore"])):
    body.session_id = session_id
    body.tenant_id = request.state.tenant_id
    body.user_id = request.state.identity.id

    llm_messages: list[Message] | None = await message_store.add_message(body)
    llm = body.llm

    config = ModelConfig(provider=llm.provider, model=llm.model, temperature=llm.temperature, api_key=llm.api_key)

    tools = body.tools

    async def events():

        if llm_messages is None:
            # 以标准的 SSE 事件格式向前端推送错误信息
            error_event: LoopEvent = LoopEvent(error=True,
                                               client_id=client_id,
                                               session_id=session_id,
                                               messages=[
                                                   Message(
                                                       id=uuid_util.uuid_str(),
                                                       status=GlobalMessageStatus.STOP,
                                                       created=int(time.time()),
                                                       role=GlobalMessageRole.ASSISTANT,
                                                       content="not new message"
                                                   )
                                               ])

            yield error_event.to_sse()
            return

        async with ModelExecutor() as executor:
            async for frame in AgentLoop(executor, config, tools, DEFAULT_LOCAL_TOOLS, session_id=session_id, client_id=client_id).run_sse(llm_messages):
                print(f"{frame}")
                yield f"{frame}"

    return StreamingResponse(events(), media_type="text/event-stream")


@router.get("/sessions")
@inject
async def list_sessions(request: Request, session_title: str | None, page: int = 1, page_size: int = 20,
                        store: MessageStore = Depends(Provide["MessageStore"])):
    tenant_id = request.state.tenant_id
    user_id = request.state.identity.id

    result = await store.list_session_messages(tenant_id, user_id, session_title, page, page_size)
    return PageResponse.ok(request, result)


@router.get("/sessions/{session_id}/messages")
@inject
async def list_messages(request: Request, session_id: str, page: int = 1, page_size: int = 20,
                        store: MessageStore = Depends(Provide["MessageStore"])):
    tenant_id = request.state.tenant_id
    user_id = request.state.identity.id

    result = await store.list_messages(tenant_id, user_id, session_id, page, page_size)
    return PageResponse.ok(request, result)
