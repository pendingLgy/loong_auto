from fastapi import APIRouter

from loong_local.schema.tools import ToolInvokeRequest
from loong_local.tools.base_tool import ToolSuspendedError
from loong_local.tools.tool_excutor import ToolExecutor
from loong_local.tools.tool_registry import GLOBAL_TOOL_REGISTRY

router = APIRouter(prefix="/tools", tags=["公共接口转发"])

@router.post("/execute-tool")
async def execute_tool_endpoint(payload: ToolInvokeRequest):

    tool = GLOBAL_TOOL_REGISTRY.get_group_definition(payload.tool_name)
    request_obj = tool.request_model(**payload.arguments)
    executor = ToolExecutor()

    try:
        # 刚开始传入 approved=False
        result = await executor.run(tool, request_obj, approved=False)
        return {"status": "success", "result": result.model_dump()}

    except ToolSuspendedError as e:
        # 1. 捕获挂起异常，将状态保存到数据库（记录当前 session、tool_name、request_data）
        # await session_repo.save_pending_approval(
        #     session_id=payload.session_id,
        #     tool_name=e.tool_name,
        #     request_data=e.request_data,
        #     summary=e.summary,
        #     risk_reason=e.risk_reason
        # )

        # 2. 通过 SSE 或 HTTP 返回给前端，弹窗提示人工审核
        return {
            "status": "suspended",
            "message": "该操作涉及高风险，需要人工审核",
            "approval_info": {
                "summary": e.summary,
                "risk_reason": e.risk_reason
            }
        }


@router.post("/chat/approve-and-resume")
async def resume_tool_endpoint(session_id: str):
    # # 1. 从数据库取出暂存的挂起任务
    # pending_task = await session_repo.get_pending_approval(session_id)
    #
    # tool = get_tool_instance(pending_task.tool_name)
    # # 用之前暂存的参数反序列化出 Request 模型
    # request_obj = tool.request_model(**pending_task.request_data)
    # executor = ToolExecutor()

    # try:
    #     # 2. 携带 approved=True 再次运行，此时安全网关放行，真正执行底层逻辑
    #     result = await executor.run(tool, request_obj, approved=True)
    #
    #     # 3. 清除挂起状态，向客户端流式返回执行结果
    #     await session_repo.clear_pending_approval(session_id)
    #     return {"status": "success", "result": result.model_dump()}
    #
    # except Exception as e:
    #     return {"status": "error", "message": str(e)}
    ...