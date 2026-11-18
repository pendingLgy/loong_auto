import json

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import Field, BaseModel

from loong_contracts.agent.models import Message
from loong_contracts.common.llm_message_constant import GlobalMessageRole, GlobalMessageStatus
from loong_contracts.common.tool_constant import ToolTaskStatus
from loong_contracts.response import BaseResponse
from loong_contracts.utis import Response
from loong_contracts.utis.uuid_util import uuid_str
from loong_local.core.logging import log_exception
from loong_local.service.pending_tool_task_service import PendingToolTaskService
from loong_local.tools.tool_excutor import ToolExecutor
from loong_local.tools.tool_registry import GLOBAL_TOOL_REGISTRY

router = APIRouter(prefix="/tools", tags=["公共接口转发"])


class ApprovalDecisionRequest(BaseModel):
    """前端提交审批决定的请求体"""
    approved: bool = Field(description="true 表示同意执行，false 表示拒绝执行")


@router.post("/{session_id}/approved/{tool_id}", response_model=BaseResponse[Message])
@inject
async def resume_tool_endpoint(
        request: Request,
        session_id: str,
        tool_id: str,
        decision: ApprovalDecisionRequest,
        pending_tool_task_service: PendingToolTaskService = Depends(Provide["PendingToolTaskService"])
):
    pending_task = await pending_tool_task_service.get_task(session_id, tool_id)
    if not pending_task:
        raise HTTPException(status_code=404, detail="未找到对应的挂起任务")

    #  如果用户选择拒绝：更新状态并清理任务，直接返回拒绝响应，不执行工具
    if not decision.approved:
        await pending_tool_task_service.update_status(session_id, tool_id, status=ToolTaskStatus.REJECTED)
        await pending_tool_task_service.remove_task(session_id, tool_id)

        tool_message = Message(
            id=uuid_str(),
            role=GlobalMessageRole.TOOL,
            status=GlobalMessageStatus.TOOL_CALLED,
            tool_call_id=tool_id,
            content="User rejected the tool",
        )

        return Response.ok(request, tool_message)

    # 3. 如果用户选择同意：获取工具类并真正执行
    tool_cls = GLOBAL_TOOL_REGISTRY.get_tool_class(pending_task.tool_name)
    tool = tool_cls(workspace=pending_task.workspace) if hasattr(pending_task, "workspace") else tool_cls(
        workspace=None)

    request_obj = tool.request_model(**pending_task.request_data)
    executor = ToolExecutor()

    try:
        # 携带 approved=True 再次运行，安全网关放行，执行底层逻辑
        result = await executor.run(tool, request_obj, approved=True)

        # 执行成功后清理挂起状态
        await pending_tool_task_service.remove_task(session_id, tool_id)

        json_str = json.dumps(result.model_dump(), ensure_ascii=False)

        tool_message = Message(
            id=uuid_str(),
            role=GlobalMessageRole.TOOL,
            status=GlobalMessageStatus.TOOL_CALLED,
            tool_call_id=tool_id,
            content=json_str,
        )

        return Response.ok(request, tool_message)

    except Exception as e:
        log_exception(e, "工具执行失败")

        # 执行出错时更新状态为失败
        await pending_tool_task_service.update_status(session_id, tool_id, status=ToolTaskStatus.FAILED)

        tool_message = Message(
            id=uuid_str(),
            role=GlobalMessageRole.TOOL,
            status=GlobalMessageStatus.TOOL_CALLED,
            tool_call_id=tool_id,
            content="Run tool failed",
        )

        Response.ok(request, tool_message)
