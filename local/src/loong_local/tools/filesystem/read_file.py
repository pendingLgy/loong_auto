"""读取工作区内文本文件。"""
from pydantic import BaseModel, Field

from ..base_tool import ABSTool, BaseToolParameters, PathArgument, ToolContext, ToolExecutionError
from ..security import PathPermission


class ReadFileParameters(BaseToolParameters):
    path: str = Field(min_length=1, description="工作区内的文件路径，可用相对路径或工作区内绝对路径")
    max_bytes: int = Field(default=256 * 1024, gt=0, le=4 * 1024 * 1024, description="最大读取字节数")


class ReadFileResult(BaseModel):
    path: str
    content: str
    size: int


class ReadFileTool(ABSTool[ReadFileParameters, ReadFileResult]):
    tool_name = "read_file"
    description = "读取工作区内的文本文件，不执行 Shell 命令"
    request_model = ReadFileParameters
    summary_fields = ("path",)

    def path_arguments(self, request: ReadFileParameters) -> dict[str, PathArgument]:
        return {"path": PathArgument(request.path, PathPermission.READ)}

    async def execute(self, context: ToolContext, request: ReadFileParameters) -> ReadFileResult:
        target = context.path("path")
        if not target.is_file():
            raise ToolExecutionError(f"目标不是普通文件：{target}")

        try:
            data = target.read_bytes()
        except OSError as exc:
            raise ToolExecutionError(f"读取文件失败：{exc}") from exc
        if b"\x00" in data:
            raise ToolExecutionError("目标疑似二进制文件，拒绝按文本读取")
        if len(data) > request.max_bytes:
            raise ToolExecutionError(f"文件超过最大读取大小 {request.max_bytes} 字节")

        return ReadFileResult(path=context.display_path(target),
                              content=data.decode("utf-8", errors="replace"),
                              size=len(data))
