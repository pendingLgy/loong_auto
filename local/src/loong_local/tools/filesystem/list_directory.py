"""列出工作区内目录内容。"""
from pydantic import BaseModel, Field

from loong_local.tools.base_tool import ABSTool, BaseToolParameters, PathArgument, ToolContext, ToolExecutionError
from loong_local.tools.security import PathPermission


class ListDirectoryParameters(BaseToolParameters):
    path: str = Field(default=".", min_length=1, description="工作区内的目录路径")
    max_entries: int = Field(default=200, gt=0, le=2000, description="最多返回的条目数")


class DirectoryEntry(BaseModel):
    name: str
    type: str
    size: int | None = None


class ListDirectoryResult(BaseModel):
    path: str
    entries: list[DirectoryEntry]


class ListDirectoryTool(ABSTool[ListDirectoryParameters, ListDirectoryResult]):
    tool_name = "list_directory"
    description = "列出工作区内目录的文件与子目录，不跟随符号链接"
    request_model = ListDirectoryParameters
    summary_fields = ("path",)

    def path_arguments(self, request: ListDirectoryParameters) -> dict[str, PathArgument]:
        return {"path": PathArgument(request.path, PathPermission.READ)}

    async def execute(self, context: ToolContext,
                      request: ListDirectoryParameters) -> ListDirectoryResult:
        target = context.path("path")
        if not target.is_dir():
            raise ToolExecutionError(f"目标不是目录：{target}")

        try:
            children = sorted(target.iterdir(), key=lambda item: (item.is_symlink(), item.name))
        except OSError as exc:
            raise ToolExecutionError(f"读取目录失败：{exc}") from exc

        entries: list[DirectoryEntry] = []
        for child in children[:request.max_entries]:
            if child.is_symlink():
                entries.append(DirectoryEntry(name=child.name, type="symlink"))
            elif child.is_dir():
                entries.append(DirectoryEntry(name=child.name, type="dir"))
            elif child.is_file():
                entries.append(DirectoryEntry(name=child.name, type="file",
                                              size=child.lstat().st_size))
            else:
                entries.append(DirectoryEntry(name=child.name, type="other"))

        return ListDirectoryResult(path=context.display_path(target), entries=entries)
