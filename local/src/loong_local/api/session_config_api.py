"""会话配置管理接口：放行策略与允许的工作目录。

这些接口用于在客户端建立会话前创建/维护配置，因此中间件对
``/session-configs`` 路径不做"会话配置必须已存在"的校验（否则无法引导创建）。
"""
from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Request
from loong_contracts.response import BaseResponse
from loong_contracts.utils import Response

from loong_local.schema.model import SessionConfigModel
from loong_local.schema.request import SessionConfigSaveRequest, SessionConfigUpdateRequest
from loong_local.service.session_config_service import SessionConfigService
from loong_local.tools.security import WorkspaceMode

router = APIRouter(prefix="/session-configs", tags=["会话配置"])





@router.get("/{session_id}", response_model=BaseResponse[SessionConfigModel])
@inject
async def get_session_config(
        request: Request,
        session_id: str,
        session_config_service: SessionConfigService = Depends(Provide["SessionConfigService"]),
):
    config = await session_config_service.get(session_id)
    if config is None:
        raise HTTPException(status_code=404, detail=f"会话配置不存在：{session_id}")
    return Response.ok(request, config)


@router.put("/{session_id}", response_model=BaseResponse[SessionConfigModel])
@inject
async def save_session_config(
        request: Request,
        session_id: str,
        body: SessionConfigSaveRequest,
        session_config_service: SessionConfigService = Depends(Provide["SessionConfigService"]),
):
    saved = await session_config_service.save(
        session_id, workspace_id=body.workspace_id, policy_model=WorkspaceMode(body.workspace_mode.value), workspaces=body.workspaces)
    return Response.ok(request, saved)


@router.patch("/{session_id}", response_model=BaseResponse[SessionConfigModel])
@inject
async def update_session_config(
        request: Request,
        session_id: str,
        body: SessionConfigUpdateRequest,
        session_config_service: SessionConfigService = Depends(Provide["SessionConfigService"]),
):
    existing = await session_config_service.get(session_id)
    if existing is None:
        return Response.fail(request, msg=f"会话配置不存在：{session_id}")

    mode = body.workspace_mode or existing.workspace_mode
    workspaces = existing.workspaces if body.workspaces is None else body.workspaces

    saved = await session_config_service.save(
        session_id, workspace_id=0, policy_model=WorkspaceMode(mode), workspaces=workspaces)
    return Response.ok(request, saved)


@router.delete("/{session_id}", response_model=BaseResponse[bool])
@inject
async def delete_session_config(
        request: Request,
        session_id: str,
        session_config_service: SessionConfigService = Depends(Provide["SessionConfigService"]),
):
    deleted = await session_config_service.delete(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"会话配置不存在：{session_id}")
    return Response.ok(request, True)
