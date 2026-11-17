"""有类型的工具注册表；注册工具必须实现 ABSTool。"""
from dataclasses import dataclass
from loong_contracts.agent.models import ToolDefinition
from .base_tool import ABSTool
from .command_tool import CommandTool, CommandRequest, CommandResult


@dataclass(frozen=True)
class ToolRegistry:
    tools: tuple[type[ABSTool], ...]

    def get(self, name: str) -> type[ABSTool] | None:
        return next((tool for tool in self.tools if tool.tool_name == name), None)

    def definitions(self) -> list[ToolDefinition]:
        return [tool.definition() for tool in self.tools]


EXECUTE_COMMAND = CommandTool.tool_name
TOOL_REGISTRY = ToolRegistry((CommandTool,))
TOOL_NAMES: set[str] = {tool.tool_name for tool in TOOL_REGISTRY.tools}
DANGEROUS_TOOLS: set[str] = {EXECUTE_COMMAND}


def definitions() -> list[ToolDefinition]:
    return TOOL_REGISTRY.definitions()
