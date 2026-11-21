"""在工作区内按文件名模式搜索文件。"""
import os
from pathlib import Path

from pydantic import BaseModel, Field

from loong_local.tools.base_tool import ABSTool, BaseToolParameters, PathArgument, ToolContext, ToolExecutionError
from loong_local.tools.security import PathPermission


class SearchFilesParameters(BaseToolParameters):
    pattern: str = Field(min_length=1, description="文件名匹配模式，如 *.py 或 sub/*.txt")
    path: str = Field(default=".", min_length=1, description="搜索起始目录，必须是工作区内目录")
    max_results: int = Field(default=100, gt=0, le=1000, description="最多返回的匹配数")


class FileMatch(BaseModel):
    path: str
    size: int


class SearchFilesResult(BaseModel):
    pattern: str
    matches: list[FileMatch]
    truncated: bool = False


class SearchFilesTool(ABSTool[SearchFilesParameters, SearchFilesResult]):
    tool_name = "search_files"
    description = "按文件名模式搜索工作区内的文件，不跟随符号链接"
    request_model = SearchFilesParameters
    summary_fields = ("pattern", "path")

    def path_arguments(self, request: SearchFilesParameters) -> dict[str, PathArgument]:
        return {"path": PathArgument(request.path, PathPermission.READ)}

    async def execute(self, context: ToolContext,
                      request: SearchFilesParameters) -> SearchFilesResult:
        root = context.path("path")
        if not root.is_dir():
            raise ToolExecutionError(f"目标不是目录：{root}")

        matches: list[FileMatch] = []
        truncated = False

        for current, dirs, files in os.walk(root, followlinks=False):
            # 不进入符号链接目录，避免搜索越出工作区。
            dirs[:] = [name for name in dirs if not Path(current, name).is_symlink()]
            for name in files:
                child = Path(current, name)
                if child.is_symlink():
                    continue

                relative = child.relative_to(root)
                try:
                    if not relative.match(request.pattern):
                        continue
                except ValueError as exc:
                    raise ToolExecutionError(f"非法的匹配模式：{request.pattern}") from exc

                if len(matches) >= request.max_results:
                    truncated = True
                    break
                try:
                    size = child.stat().st_size
                except OSError:
                    size = 0
                matches.append(FileMatch(path=context.display_path(child), size=size))
            if truncated:
                break

        matches.sort(key=lambda match: match.path)
        return SearchFilesResult(pattern=request.pattern, matches=matches, truncated=truncated)
