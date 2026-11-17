"""当前系统 Shell 工具。"""
import asyncio
import os
import platform
import shutil
from pathlib import Path
from pydantic import Field, BaseModel
from loong_local.tools.base_tool import ABSTool, ToolUnauthorizedError, BaseToolRequest  # 引入标准的未授权异常
from loong_local.tools.dangerous_commands import is_dangerous_command


class CommandRequest(BaseToolRequest):
    tool_id: str
    command: str = Field(min_length=1)
    dangerous: bool
    risk_reason: str = ""
    timeout: float = Field(default=30, gt=0, le=300)


class CommandResult(BaseToolRequest):
    tool_id: str
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool = False


class ShellTool(ABSTool[CommandRequest, CommandResult]):
    tool_name = "shell_command"
    description = "执行本地原生 Shell 命令，读取和编辑文件；必须准确填写风险标记"
    request_model = CommandRequest

    def __init__(self, workspace: Path):
        super().__init__(workspace)
        self.shell = (shutil.which("pwsh") or shutil.which("powershell")) if os.name == "nt" else (shutil.which("bash") or shutil.which("sh"))
        if not self.shell:
            raise RuntimeError("未找到 Shell")

    def is_dangerous(self, request: CommandRequest) -> bool:
        return is_dangerous_command(request.command, declared_dangerous=request.dangerous)

    def approval_details(self, request: CommandRequest) -> tuple[str, str]:
        return request.command, request.risk_reason or "无法确定为纯读取操作"

    def system_prompt(self) -> str:
        return (f"用户系统：{platform.system()} {platform.release()}；Shell：{self.shell}；工作区：{self.workspace}。"
                "使用原生系统命令，不使用 Python 操作文件。文本使用 UTF-8。"
                "编辑, 删除, 新增非临时文件, 安装软件和修改系统配置必须 dangerous=true 并说明 risk_reason。"
                "不确定时标记危险。不能自行声明已经授权。只操作用户指定范围。")

    async def execute(self, request: CommandRequest, *, approved: bool = False) -> CommandResult:
        # 双重防御：确保即使绕过 __call__ 直接调用 execute，也能通过标准异常拦截未授权操作
        if not approved and self.is_dangerous(request):
            raise ToolUnauthorizedError(f"命令: {request.command} (未获授权)")

        command = request.command
        arguments = ["-c"]
        if os.name == "nt":
            arguments = ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]
            command = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " + command

        # cwd 不是安全沙箱；创建进程参数只在系统边界使用。
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

        return CommandResult(
            tool_id=request.tool_id,
            exit_code=process.returncode,
            stdout=stdout.decode("utf-8", errors="replace"),
            stderr=stderr.decode("utf-8", errors="replace"),
            timed_out=timed_out
        )