"""删除工作区内普通文件。"""
from pydantic import BaseModel, Field

from loong_local.tools.base_tool import ABSTool, BaseToolParameters, PathArgument, ToolContext, ToolExecutionError
from loong_local.tools.security import PathPermission


class DeleteFileParameters(BaseToolParameters):
    path: str = Field(min_length=1, description="工作区内要删除的普通文件路径")


class DeleteFileResult(BaseModel):
    path: str


class DeleteFileTool(ABSTool[DeleteFileParameters, DeleteFileResult]):
    tool_name = "delete_file"
    description = "删除工作区内的普通文件，不删除目录"
    request_model = DeleteFileParameters
    requires_approval = True
    summary_fields = ("path",)

    def path_arguments(self, request: DeleteFileParameters) -> dict[str, PathArgument]:
        return {"path": PathArgument(request.path, PathPermission.DELETE)}

    async def execute(self, context: ToolContext, request: DeleteFileParameters) -> DeleteFileResult:
        target = context.path("path")
        if target.is_dir():
            raise ToolExecutionError("拒绝删除目录，请先处理目录内的文件")

        try:
            target.unlink()
        except OSError as exc:
            raise ToolExecutionError(f"删除文件失败：{exc}") from exc

        return DeleteFileResult(path=context.display_path(target))
