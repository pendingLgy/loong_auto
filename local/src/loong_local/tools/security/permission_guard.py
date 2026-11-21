"""工具权限矩阵：工具能力声明与操作权限校验。

路径合法不等于工具拥有该操作权限；工具只能使用权限矩阵中授予的能力。
实际权限仍应由执行环境强制实施，这里的矩阵是应用层的第一道约束。
"""
from dataclasses import dataclass, field

from loong_local.tools.security.path_guard import PathPermission


class ToolPermissionError(Exception):
    """工具没有声明执行该操作的权限。"""


# 文档 §5.2 的工具权限矩阵；未列出的工具默认不允许任何路径操作。
DEFAULT_TOOL_PERMISSIONS: dict[str, frozenset[PathPermission]] = {
    "read_file": frozenset({PathPermission.READ}),
    "write_file": frozenset({PathPermission.READ, PathPermission.WRITE}),
    "delete_file": frozenset({PathPermission.DELETE}),
    "list_directory": frozenset({PathPermission.READ}),
    "search_files": frozenset({PathPermission.READ}),
    "create_directory": frozenset({PathPermission.WRITE}),
    "move_file": frozenset({PathPermission.READ, PathPermission.WRITE, PathPermission.DELETE}),
    "copy_file": frozenset({PathPermission.READ, PathPermission.WRITE}),
    "shell_command": frozenset({PathPermission.READ, PathPermission.WRITE,
                                PathPermission.DELETE, PathPermission.EXECUTE}),
}


@dataclass(frozen=True)
class ToolPermissionGuard:
    matrix: dict[str, frozenset[PathPermission]] = field(
        default_factory=lambda: dict(DEFAULT_TOOL_PERMISSIONS))

    def permissions(self, tool_name: str) -> frozenset[PathPermission]:
        return self.matrix.get(tool_name, frozenset())

    def check(self, tool_name: str, permission: PathPermission) -> None:
        granted = self.permissions(tool_name)
        if permission not in granted:
            raise ToolPermissionError(
                f"工具 {tool_name} 未声明 {permission.value} 权限，拒绝执行")
