"""在工作区内创建目录。"""
from pydantic import BaseModel, Field

from ..base_tool import ABSTool, BaseToolParameters, PathArgument, ToolContext, ToolExecutionError
from ..security import PathPermission


class CreateDirectoryParameters(BaseToolParameters):
    path: str = Field(min_length=1, description="工作区内要创建的目录路径")
    parents: bool = Field(default=False, description="父目录不存在时是否递归创建")


class CreateDirectoryResult(BaseModel):
    path: str


class CreateDirectoryTool(ABSTool[CreateDirectoryParameters, CreateDirectoryResult]):
    tool_name = "create_directory"
    description = "在工作区内创建目录，已存在时返回错误"
    request_model = CreateDirectoryParameters
    requires_approval = True
    summary_fields = ("path",)

    def path_arguments(self, request: CreateDirectoryParameters) -> dict[str, PathArgument]:
        # parents=True 时目标目录可能尚不存在，只校验归属与最近祖先的可写性。
        return {"path": PathArgument(request.path, PathPermission.WRITE,
                                     allow_missing=request.parents)}

    async def execute(self, context: ToolContext,
                      request: CreateDirectoryParameters) -> CreateDirectoryResult:
        target = context.path("path")
        if target.exists():
            raise ToolExecutionError(f"目录已存在：{target}")

        try:
            target.mkdir(parents=request.parents, exist_ok=False)
        except OSError as exc:
            raise ToolExecutionError(f"创建目录失败：{exc}") from exc

        return CreateDirectoryResult(path=context.display_path(target))
