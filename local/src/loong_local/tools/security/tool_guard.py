"""工具调用守卫：工具白名单。

路径与沙箱由 ToolExecutor / PathGuard 负责；这里只做工具层面的准入。
"""

from typing import Iterable, Optional

from .permission_guard import ToolPermissionError


class ToolGuard:
    def __init__(self, allowed_tools: Optional[Iterable[str]] = None) -> None:
        self.allowed_tools = None if allowed_tools is None else frozenset(allowed_tools)

    def check_tool(self, tool_name: str) -> None:
        if self.allowed_tools is not None and tool_name not in self.allowed_tools:
            raise ToolPermissionError(f"工具 {tool_name} 不在允许调用列表中")
