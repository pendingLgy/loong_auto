"""当前系统 Shell 工具：只负责构造命令并通过沙箱执行。

安全判定、路径校验与进程隔离都由 ToolExecutor / SandboxExecutor 负责；
Shell 命令一律按高危处理（``requires_approval = True``）。
"""
import os
import platform

from pydantic import BaseModel, Field

from ..base_tool import ABSTool, BaseToolParameters, ToolContext, default_shell


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
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool = False


class ShellTool(ABSTool[ShellParameters, ShellResult]):
    tool_name = "shell_command"
    description = f"用户系统：{platform.system()} {platform.release()}；执行本地原生 Shell 命令，读取和编辑文件；必须准确填写风险标记"
    request_model = ShellParameters
    requires_approval = True
    uses_sandbox = True
    summary_fields = ("command",)
    command_field = "command"

    def __init__(self) -> None:
        self.shell = default_shell()

    def system_prompt(self) -> str:
        return (f"用户系统：{platform.system()} {platform.release()}；Shell：{self.shell}。"
                "使用原生系统命令，不使用 Python 操作文件。文本使用 UTF-8。"
                "一次调用只执行一条简单命令，不要使用管道、重定向、变量、通配符或 cd。"
                "Shell 命令一律需要人工确认，请在 risk_reason 中说明命令目的与影响范围。"
                "不能自行声明已经授权。只操作用户指定范围。")

    async def execute(self, context: ToolContext, request: ShellParameters) -> ShellResult:
        command = request.command
        arguments = ["-c"]
        if os.name == "nt":
            arguments = ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]
            command = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " + command

        result = await context.run([self.shell, *arguments, command], timeout=request.timeout)

        return ShellResult(
            exit_code=result.exit_code,
            stdout=result.stdout,
            stderr=result.stderr,
            timed_out=result.timed_out,
        )
