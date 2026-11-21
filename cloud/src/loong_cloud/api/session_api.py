"""会话接口。"""

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Query, Request
from loong_contracts.request.session import CreateSessionRequest, UpdateSessionRequest
from loong_contracts.utils import Response
from loong_contracts.utils.response import PageResponse

from loong_cloud.storage.session_store import SessionStore

router = APIRouter(prefix="/sessions", tags=["会话"])


@router.get("")
@inject
async def list_sessions(
    request: Request,
    workspace_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    store: SessionStore = Depends(Provide["SessionStore"]),
):
    """分页查看当前用户的会话，可按工作目录过滤。"""
    result = await store.page(
        request.state.tenant_id,
        request.state.identity.id,
        workspace_id,
        page,
        page_size,
    )
    return PageResponse.ok(request, result)


@router.post("")
@inject
async def create_session(
    request: Request,
    body: CreateSessionRequest,
    store: SessionStore = Depends(Provide["SessionStore"]),
):
    """新增会话。"""

    item = await store.create(
        request.state.tenant_id,
        request.state.identity.id,
        body.session_id,
        body.session_title,
        body.workspace_id,
    )

    return Response.ok(request, item)


@router.get("/{session_id}")
@inject
async def get_session(
    request: Request,
    session_id: str,
    workspace_id: int,
    store: SessionStore = Depends(Provide["SessionStore"]),
):
    """查看会话详情。"""
    item = await store.get(request.state.tenant_id, request.state.identity.id, session_id, workspace_id)
    if item is None:
        return Response.fail(request, code=404, msg="会话不存在")
    return Response.ok(request, item)


@router.put("/{session_id}")
@inject
async def update_session(
    request: Request,
    session_id: str,
    body: UpdateSessionRequest,
    store: SessionStore = Depends(Provide["SessionStore"]),
):
    """编辑会话标题或所属工作目录。"""
    tenant_id = request.state.tenant_id
    user_id = request.state.identity.id

    if await store.get(tenant_id, user_id, session_id, body.workspace_id) is None:
        return Response.fail(request, code=404, msg="会话不存在")

    item = await store.update(
        tenant_id,
        user_id,
        body.workspace_id,
        session_id,
        body.session_title,
    )
    return Response.ok(request, item)
