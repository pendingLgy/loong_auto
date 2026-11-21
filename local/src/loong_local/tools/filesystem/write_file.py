"""写入工作区内文本文件。"""
from pydantic import BaseModel, Field

from loong_local.tools.base_tool import ABSTool, BaseToolParameters, PathArgument, ToolContext, ToolExecutionError
from loong_local.tools.security import PathPermission


class WriteFileParameters(BaseToolParameters):
    path: str = Field(min_length=1, description="工作区内的目标文件路径，父目录必须已存在")
    content: str = Field(default="", description="写入的文本内容，UTF-8 编码")
    overwrite: bool = Field(default=False, description="目标文件已存在时必须显式置为 true")


class WriteFileResult(BaseModel):
    path: str
    size: int


class WriteFileTool(ABSTool[WriteFileParameters, WriteFileResult]):
    tool_name = "write_file"
    description = "在工作区内写入文本文件；覆盖已有文件必须显式声明"
    request_model = WriteFileParameters
    requires_approval = True
    summary_fields = ("path",)

    def path_arguments(self, request: WriteFileParameters) -> dict[str, PathArgument]:
        return {"path": PathArgument(request.path, PathPermission.WRITE)}

    async def execute(self, context: ToolContext, request: WriteFileParameters) -> WriteFileResult:
        target = context.path("path")
        if target.exists() and not request.overwrite:
            raise ToolExecutionError("目标文件已存在，需 overwrite=true 才能覆盖")

        try:
            target.write_text(request.content, encoding="utf-8")
        except OSError as exc:
            raise ToolExecutionError(f"写入文件失败：{exc}") from exc

        return WriteFileResult(path=context.display_path(target),
                               size=len(request.content.encode("utf-8")))
