"""工作目录接口。"""

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Query, Request
from loong_contracts.request.working_directory import (
    CreateWorkingDirectoryRequest,
    UpdateWorkingDirectoryRequest,
)
from loong_contracts.utils import Response
from loong_contracts.utils.response import PageResponse

from loong_cloud.storage.workspace_store import WorkspaceStore

router = APIRouter(prefix="/workspace", tags=["工作目录"])


@router.get("")
@inject
async def list_workspaces(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    store: WorkspaceStore = Depends(Provide["WorkspaceStore"]),
):
    """分页查询当前用户的工作目录。"""
    result = await store.list(request.state.tenant_id, request.state.identity.id, page, page_size)
    return PageResponse.ok(request, result)


@router.post("")
@inject
async def create_workspace(
    request: Request,
    body: CreateWorkingDirectoryRequest,
    store: WorkspaceStore = Depends(Provide["WorkspaceStore"]),
):
    """创建工作目录。"""
    item = await store.create(
        request.state.tenant_id,
        request.state.identity.id,
        body.name,
        body.path,
    )
    return Response.ok(request, item)


@router.get("/{workspace_id}")
@inject
async def get_workspace(
    request: Request,
    workspace_id: int,
    store: WorkspaceStore = Depends(Provide["WorkspaceStore"]),
):
    """查询单个工作目录。"""
    item = await store.get(request.state.tenant_id, request.state.identity.id, workspace_id)
    if item is None:
        return Response.fail(request, code=404, msg="工作目录不存在")
    return Response.ok(request, item)


@router.put("/{workspace_id}")
@inject
async def update_workspace(
    request: Request,
    workspace_id: int,
    body: UpdateWorkingDirectoryRequest,
    store: WorkspaceStore = Depends(Provide["WorkspaceStore"]),
):
    """更新工作目录。"""
    item = await store.update(
        request.state.tenant_id,
        request.state.identity.id,
        workspace_id,
        body.name,
        body.path,
    )
    if item is None:
        return Response.fail(request, code=404, msg="工作目录不存在")
    return Response.ok(request, item)


@router.delete("/{workspace_id}")
@inject
async def delete_workspace(
    request: Request,
    workspace_id: int,
    store: WorkspaceStore = Depends(Provide["WorkspaceStore"]),
):
    """删除工作目录（逻辑删除）。"""
    deleted = await store.delete(request.state.tenant_id, request.state.identity.id, workspace_id)
    if not deleted:
        return Response.fail(request, code=404, msg="工作目录不存在")
    return Response.ok(request, {"deleted": True})
