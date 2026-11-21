"""Loong Cloud Agent 工具注册中心（纯手动注册版）。"""

from loong_contracts.agent.models import ToolDefinition

from loong_local.tools.base_tool import ABSTool


class ToolRegistry:
    """
    纯手动显式注册的工具管理中心
    """
    def __init__(self):
        self._registry: dict[str, type[ABSTool]] = {}
        self._instances: dict[str, ABSTool] = {}

    def register_class(self, tool_class: type[ABSTool]) -> None:
        """显式注册工具类"""
        if not hasattr(tool_class, "tool_name") or not tool_class.tool_name:
            raise ValueError(f"工具类 {tool_class.__name__} 必须定义有效的 tool_name 类属性")

        name = tool_class.tool_name
        if name in self._registry:
            raise KeyError(f"工具名称 '{name}' 已经被注册，禁止重复注册")

        self._registry[name] = tool_class

    def register_instance(self, instance: ABSTool) -> None:
        """显式注册工具实例（用于单例或携带特定运行时状态的工具）"""
        tool_class = type(instance)
        if not hasattr(tool_class, "tool_name") or not tool_class.tool_name:
            raise ValueError(f"工具实例的类 {tool_class.__name__} 必须定义有效的 tool_name")

        name = tool_class.tool_name
        self._registry[name] = tool_class
        self._instances[name] = instance

    def get_tool_class(self, tool_name: str) -> type[ABSTool]:
        tool_cls = self._registry.get(tool_name)
        if not tool_cls:
            raise KeyError(f"未找到注册的工具类: {tool_name}")
        return tool_cls

    def create_tool_instance(self, tool_name: str) -> ABSTool:
        """创建工具实例；执行环境（路径、沙箱）由 ToolExecutor 通过 ToolContext 注入。"""
        if tool_name in self._instances:
            return self._instances[tool_name]

        tool_cls = self.get_tool_class(tool_name)
        return tool_cls()

    def list_tool_names(self) -> list[str]:
        return list(self._registry.keys())

    def get_all_definitions(self) -> list[ToolDefinition]:
        return [tool_cls.definition() for tool_cls in self._registry.values()]

    def get_group_definitions(self, tool_names: list[str]) -> list[ToolDefinition]:
        return [self.get_tool_class(name).definition() for name in tool_names]

    def get_group_definition(self, tool_name: str) -> ToolDefinition:
        return self.get_tool_class(tool_name).definition()

# 全局单例注册中心实例
GLOBAL_TOOL_REGISTRY = ToolRegistry()