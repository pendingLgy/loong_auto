"""当前系统 Shell 工具。

执行前按固定顺序校验：授权判定 → 工作目录 → 命令引用路径 → 启动进程。
路径校验只做保守拦截：结构无法静态分析时按危险命令要求人工审批，不做猜测。
"""
import asyncio
import os
import platform
import re
import shutil
from pathlib import Path
from typing import List

from pydantic import Field, BaseModel

from loong_local.core.exceptions import ToolExecuteError
from loong_local.tools.base_tool import ABSTool, ToolUnauthorizedError, BaseToolParameters
from loong_local.tools.dangerous_commands import has_unsafe_structure, is_dangerous_command


class ShellParameters(BaseToolParameters):
    """Shell 命令工具参数定义"""

    command: str = Field(
        min_length=1,
        description=(
            "要执行的完整 Shell 命令。一次调用只写一条简单命令，不要使用管道、重定向、"
            "变量、通配符或多条命令串联；命令操作的文件路径必须位于允许的工作空间内。"
        ),
    )

    timeout: float = Field(default=30, gt=0, le=300, description="命令执行超时（秒）")


class ShellResult(BaseModel):
    tool_id: str
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool = False


class ShellTool(ABSTool[ShellParameters, ShellResult]):
    tool_name = "shell_command"
    description = f"用户系统：{platform.system()} {platform.release()}；执行本地原生 Shell 命令，读取和编辑文件；必须准确填写风险标记"
    request_model = ShellParameters

    def __init__(self, workspaces: List[Path]):
        super().__init__(workspaces)
        self.shell = (shutil.which("pwsh") or shutil.which("powershell")) if os.name == "nt" else (
            shutil.which("bash") or shutil.which("sh"))
        if not self.shell:
            raise RuntimeError("未找到 Shell")

    def is_dangerous(self, request: ShellParameters) -> bool:
        # 纯判定，不做文件系统访问：该方法也会在 SSE 解析阶段被调用。
        # 无法静态分析的结构（管道/重定向/变量/通配符/多命令/切换目录）由下层统一判为危险。
        return is_dangerous_command(request.command, declared_dangerous=request.dangerous)

    def approval_details(self, request: ShellParameters) -> tuple[str, str]:
        return request.command, request.risk_reason or "无法确定为纯读取操作"

    async def execute(self, tool_id: str, request: ShellParameters, *, approved: bool = False) -> ShellResult:

        if not approved and self.is_dangerous(request):
            raise ToolUnauthorizedError(f"命令: {request.command} (未获授权)")

        # 4. 执行。
        command = request.command
        arguments = ["-c"]

        process = await asyncio.create_subprocess_exec(
            self.shell, *arguments, command,
            cwd=self.workspace,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            creationflags=0x08000000 if os.name == "nt" else 0
        )

        task = asyncio.create_task(process.communicate())
        timed_out = False
        try:
            stdout, stderr = await asyncio.wait_for(asyncio.shield(task), request.timeout)
        except asyncio.TimeoutError:
            timed_out = True
            if process.returncode is None:
                process.kill()
            stdout, stderr = await task
        except asyncio.CancelledError:
            if process.returncode is None:
                process.kill()
            await task
            raise

        return ShellResult(
            tool_id=tool_id,
            exit_code=process.returncode,
            stdout=stdout.decode("utf-8", errors="replace"),
            stderr=stderr.decode("utf-8", errors="replace"),
            timed_out=timed_out
        )

