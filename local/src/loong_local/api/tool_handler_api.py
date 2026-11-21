"""工具审批恢复接口：确认后通过统一执行入口真正执行工具。"""
import json

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Request
from loong_contracts.agent.models import Message
from loong_contracts.common.llm_message_constant import (
    GlobalMessageRole,
    GlobalMessageStatus,
)
from loong_contracts.common.tool_constant import ToolTaskStatus
from loong_contracts.response import BaseResponse
from loong_contracts.utils import Response
from loong_contracts.utils.uuid_util import uuid_str
from pydantic import BaseModel, Field

from loong_local.core.context import SSEContext
from loong_local.core.logging import log_exception
from loong_local.schema.model import PendingToolTaskModel
from loong_local.service.pending_tool_task_service import PendingToolTaskService
from loong_local.service.session_config_service import SessionConfigService
from loong_local.tools.tool_executor import ToolCallRequest

router = APIRouter(prefix="/tools", tags=["工具审批"])


class ApprovalDecisionRequest(BaseModel):
    """前端提交审批决定的请求体"""
    approved: bool = Field(description="true 表示同意执行，false 表示拒绝执行")


def _tool_message(tool_id: str, content: str) -> Message:
    return Message(id=uuid_str(), role=GlobalMessageRole.TOOL,
                   status=GlobalMessageStatus.TOOL_CALLED, tool_call_id=tool_id, content=content)


@router.post("/{session_id}/approved/{tool_id}", response_model=BaseResponse[Message])
@inject
async def resume_tool_endpoint(
        request: Request,
        session_id: str,
        tool_id: str,
        decision: ApprovalDecisionRequest,
        pending_tool_task_service: PendingToolTaskService = Depends(Provide["PendingToolTaskService"]),
        session_config_service: SessionConfigService = Depends(Provide["SessionConfigService"])
):

    context: SSEContext = request.state.sse_context

    session_config = await session_config_service.get(session_id)
    if session_config is None:
        return Response.fail(request,msg="工作目录未配置")

    policy = SessionConfigService.to_policy(session_config)
    # 工作目录只做解析前的传递，存在性校验延迟到工具执行时处理，减少中间件耗时。
    workspaces = SessionConfigService.to_workspaces(session_config)

    pending_task:PendingToolTaskModel = await pending_tool_task_service.get_task(session_id, tool_id)
    if not pending_task:
        raise HTTPException(status_code=404, detail="未找到对应的挂起任务")

    # 用户拒绝：更新状态、清理任务，不执行工具。
    if not decision.approved:
        await pending_tool_task_service.update_status(session_id, tool_id, status=ToolTaskStatus.REJECTED)
        await pending_tool_task_service.remove_task(session_id, tool_id)
        return Response.ok(request, _tool_message(tool_id, "User rejected the tool"))

    # 用户同意：用单例执行器执行，执行时传入本会话的策略与工作目录。
    executor = context.tool_executor or request.app.state.tool_executor

    try:
        result = await executor.execute(
            ToolCallRequest(tool_id=tool_id, tool_name=pending_task.tool_name,
                            arguments=pending_task.request_data),
            approved=True,
            policy=policy,
            workspaces=tuple(workspaces),
        )
    except Exception as exc:
        log_exception(exc, "工具执行失败")
        await pending_tool_task_service.update_status(session_id, tool_id, status=ToolTaskStatus.FAILED)
        return Response.ok(request, _tool_message(tool_id, "Run tool failed"))

    await pending_tool_task_service.remove_task(session_id, tool_id)
    return Response.ok(request, _tool_message(tool_id,
                                              json.dumps(result.model_dump(), ensure_ascii=False)))
