"""在工作区内复制文件。"""
import shutil

from pydantic import BaseModel, Field

from ..base_tool import ABSTool, BaseToolParameters, PathArgument, ToolContext, ToolExecutionError
from ..security import PathPermission


class CopyFileParameters(BaseToolParameters):
    source: str = Field(min_length=1, description="工作区内要复制的文件路径")
    destination: str = Field(min_length=1, description="工作区内的目标文件路径，父目录必须已存在")
    overwrite: bool = Field(default=False, description="目标文件已存在时必须显式置为 true")


class CopyFileResult(BaseModel):
    source: str
    destination: str
    size: int


class CopyFileTool(ABSTool[CopyFileParameters, CopyFileResult]):
    tool_name = "copy_file"
    description = "在工作区内复制文件，不复制目录"
    request_model = CopyFileParameters
    requires_approval = True
    summary_fields = ("source", "destination")

    def path_arguments(self, request: CopyFileParameters) -> dict[str, PathArgument]:
        return {
            "source": PathArgument(request.source, PathPermission.READ),
            "destination": PathArgument(request.destination, PathPermission.WRITE),
        }

    async def execute(self, context: ToolContext, request: CopyFileParameters) -> CopyFileResult:
        source = context.path("source")
        destination = context.path("destination")

        if not source.is_file():
            raise ToolExecutionError(f"源路径不是普通文件：{source}")
        if destination.is_dir():
            raise ToolExecutionError("目标路径是目录，请直接指定完整文件路径")
        if destination.exists() and not request.overwrite:
            raise ToolExecutionError("目标文件已存在，需 overwrite=true 才能覆盖")

        try:
            shutil.copyfile(str(source), str(destination))
        except OSError as exc:
            raise ToolExecutionError(f"复制文件失败：{exc}") from exc

        return CopyFileResult(source=context.display_path(source),
                              destination=context.display_path(destination),
                              size=destination.stat().st_size)
