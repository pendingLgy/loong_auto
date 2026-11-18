"""工具执行器：支持配置重试、超时及异常隔离。"""
import asyncio
from typing import TypeVar, Optional

from loguru import logger
from pydantic import BaseModel

from .base_tool import ABSTool, ToolUnauthorizedError, ToolExecutionError, ToolSuspendedError

InputT = TypeVar("InputT", bound=BaseModel)
OutputT = TypeVar("OutputT", bound=BaseModel)


class ToolExecutionConfig(BaseModel):
    max_retries: int = 3  # 最大重试次数
    initial_delay: float = 1.0  # 初始退避延迟（秒）
    backoff_factor: float = 2.0  # 退避倍数
    global_timeout: Optional[float] = None  # 全局执行硬超时（秒）


class ToolExecutor:
    def __init__(self, config: Optional[ToolExecutionConfig] = None):
        self.config = config or ToolExecutionConfig()

    async def run(
            self,
            tool_id: str,
            tool: ABSTool[InputT, OutputT],
            request: InputT,
            *,
            approved: bool = False
    ) -> OutputT:
        retries = 0
        delay = self.config.initial_delay

        while True:
            try:
                if self.config.global_timeout:
                    return await asyncio.wait_for(
                        tool(tool_id, request, approved=approved),
                        timeout=self.config.global_timeout
                    )
                else:
                    return await tool(tool_id, request, approved=approved)

            except ToolSuspendedError as e:
                # 【核心】人工审核挂起：这是预期内的业务中断，绝对不重试，直接向上抛出给网关托管
                logger.info(f"工具执行已挂起，等待人工审核 -> Tool: {e.tool_name}, Summary: {e.summary}")
                raise e

            except ToolUnauthorizedError as e:
                logger.warning(f"工具操作被拒绝: {e}")
                raise e

            except Exception as e:
                retries += 1
                if retries > self.config.max_retries:
                    logger.error(f"工具执行失败，已达最大重试次数: {e}")
                    raise ToolExecutionError(f"工具执行失败: {str(e)}")

                logger.warning(f"工具执行出错 ({type(e).__name__}): {e}。正在进行第 {retries} 次重试...")
                await asyncio.sleep(delay)
                delay *= self.config.backoff_factor
