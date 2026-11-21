"""在工作区内移动或重命名文件。"""
import shutil

from pydantic import BaseModel, Field

from loong_local.tools.base_tool import ABSTool, BaseToolParameters, PathArgument, ToolContext, ToolExecutionError
from loong_local.tools.security import PathPermission


class MoveFileParameters(BaseToolParameters):
    source: str = Field(min_length=1, description="工作区内要移动的文件路径")
    destination: str = Field(min_length=1, description="工作区内的目标文件路径，父目录必须已存在")
    overwrite: bool = Field(default=False, description="目标文件已存在时必须显式置为 true")


class MoveFileResult(BaseModel):
    source: str
    destination: str


class MoveFileTool(ABSTool[MoveFileParameters, MoveFileResult]):
    tool_name = "move_file"
    description = "在工作区内移动或重命名文件，不移动目录"
    request_model = MoveFileParameters
    requires_approval = True
    summary_fields = ("source", "destination")

    def path_arguments(self, request: MoveFileParameters) -> dict[str, PathArgument]:
        return {
            "source": PathArgument(request.source, PathPermission.DELETE),
            "destination": PathArgument(request.destination, PathPermission.WRITE),
        }

    async def execute(self, context: ToolContext, request: MoveFileParameters) -> MoveFileResult:
        source = context.path("source")
        destination = context.path("destination")

        if source.is_dir():
            raise ToolExecutionError("拒绝移动目录，请逐个文件处理")
        if not source.is_file():
            raise ToolExecutionError(f"源路径不是普通文件：{source}")
        if destination.is_dir():
            raise ToolExecutionError("目标路径是目录，请直接指定完整文件路径")
        if destination.exists() and not request.overwrite:
            raise ToolExecutionError("目标文件已存在，需 overwrite=true 才能覆盖")

        try:
            shutil.move(str(source), str(destination))
        except OSError as exc:
            raise ToolExecutionError(f"移动文件失败：{exc}") from exc

        return MoveFileResult(source=context.display_path(source),
                              destination=context.display_path(destination))
