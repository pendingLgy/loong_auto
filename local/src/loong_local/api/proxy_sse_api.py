"""SSE 订阅入口，持久化事件支持 Last-Event-ID；不在回放时执行工具。"""
import asyncio

import httpx
from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Request, Depends
from loguru import logger
from starlette.responses import Response, StreamingResponse

from loong_contracts.agent.models import LoopEvent
from loong_contracts.common.llm_message_constant import GlobalMessageStatus
from ..core.context import SSEContext
from ..core.logging import log_exception
from ..tools.tool_executor import ToolExecutor
from ..service.pending_tool_task_service import PendingToolTaskService

router = APIRouter(prefix="/sse", tags=["sse订阅转发"])


@router.get("/subscribe")
@inject
async def subscribe(
    request: Request,
    pending_tool_task_service: PendingToolTaskService = Depends(Provide["PendingToolTaskService"])
):
    context: SSEContext = request.state.sse_context
    cloud_client = context.cloud_client
    client_id = context.client_id

    # 保留客户端原始请求头（含 Last-Event-ID），再补充网关身份头。
    headers = httpx.Headers(request.headers)
    headers.update(context.headers())
    cloud_client.http.headers = headers

    # 1. 直接获取上游打开 the response 句柄
    try:
        upstream_response = await cloud_client.events.subscribe(context.client_id)
    except Exception as e:
        return Response(content=f"Upstream connect failed: {str(e)}", status_code=502)

    # 💡 定义专属的任务队列（容量可以根据需要限制，比如 1000）
    task_queue: asyncio.Queue = asyncio.Queue()

    # 💡 开启后台 Worker 循环：专门从队列中安全串行消费并写入数据库
    async def db_worker():
        while True:
            try:
                task_data = await task_queue.get()
                if task_data is None:  # 收到退出信号
                    task_queue.task_done()
                    break

                # 提取参数解包
                tool_id, session_id, tool_name, request_data, summary, risk_reason = task_data

                try:
                    await pending_tool_task_service.save_pending_task(
                        tool_id=tool_id,
                        session_id=session_id,
                        tool_name=tool_name,
                        request_data=request_data,
                        summary=summary,
                        risk_reason=risk_reason
                    )
                except Exception as db_err:
                    logger.error(f"后台数据库持久化任务执行失败: {db_err}")
                finally:
                    task_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as worker_err:
                logger.error(f"DB Worker 异常: {worker_err}")

    # 启动后台 Worker 任务
    worker_task = asyncio.create_task(db_worker())

    # 2. 定义流式生成器：生命周期完全由 generator 的 finally 托管
    async def generate_proxy_stream():
        try:
            async for raw_chunk in upstream_response.aiter_raw():
                # print(f"{raw_chunk.decode('utf-8')}")
                yield raw_chunk

                # 拼接缓冲区并按行切分，防止网络分包截断 JSON
                data_content = raw_chunk.decode("utf-8", errors="ignore").strip()
                lines = data_content.split("\n")

                if not lines:
                    continue

                current_event = None
                if lines[0].startswith("event:"):
                    current_event = lines[0][len("event:"):].strip()

                if current_event in [GlobalMessageStatus.TOOL_CALLING.value]:
                    try:
                        if len(lines) > 1 and lines[1].startswith("data:"):
                            loop_event: LoopEvent = LoopEvent.model_validate_json(lines[1][len("data:"):].strip())

                            if loop_event.remote_tool_calls:
                                # 统一走工具执行入口做准入与审批判定，调度层不再自己查注册表。
                                executor = ToolExecutor(context.workspaces, policy=context.policy)
                                for tool_call in loop_event.remote_tool_calls:
                                    try:
                                        inspection = executor.inspect(tool_call.name, tool_call.arguments)
                                    except Exception as guard_error:
                                        logger.warning("工具准入失败，已跳过调度 tool={} error={}",
                                                       tool_call.name, guard_error)
                                        continue

                                    # 💡 极速非阻塞：将持久化参数打包推入队列，毫秒级返回，绝不卡住 SSE 流
                                    await task_queue.put((
                                        tool_call.id,
                                        loop_event.session_id,
                                        tool_call.name,
                                        inspection.request.model_dump(mode="json"),
                                        inspection.summary,
                                        inspection.risk_reason if inspection.needs_approval else None
                                    ))

                    except Exception as parse_err:
                        log_exception(parse_err,
                                      f"解析或推送持久化任务失败: {parse_err}, 原始数据: {data_content}")

        except Exception as e:
            raise e
        finally:
            logger.info(f"{client_id} close sse")
            # 3. 清理收尾：通知后台 Worker 优雅退出，并关闭上游连接
            await task_queue.put(None)  # 发送停止信号
            try:
                # 等待队列中剩余任务处理完毕（可设超时防死等）
                await asyncio.wait_for(task_queue.join(), timeout=3.0)
            except asyncio.TimeoutError:
                logger.warning(f"{client_id} SSE 关闭时部分后台持久化任务未能在超时时间内完成")

            # 取消 Worker 任务
            worker_task.cancel()

            # 安全关闭上游代理连接
            await upstream_response.aclose()

    return StreamingResponse(
        generate_proxy_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Local-Request-ID": context.local_request_id,
            "X-Request-ID": upstream_response.headers.get("x-request-id", "-"),
            "X-Request-Date": upstream_response.headers.get("x-request-date", "-"),
        }
    )