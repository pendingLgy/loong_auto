from loguru import logger

from loong_local.tools.system.shell_tool import ShellTool
from loong_local.tools.tool_registry import GLOBAL_TOOL_REGISTRY

# 服务注册
SERVICE_TARGETS = [
    'loong_local.service',
]

# 依赖注入路径
WIRE_TARGETS = [
    'loong_local.api',
]


def init_tools():
    """在应用启动阶段集中显式注册所有工具"""
    GLOBAL_TOOL_REGISTRY.register_class(ShellTool)

    logger.info(f"已成功加载并注册工具: {GLOBAL_TOOL_REGISTRY.list_tool_names()}")
