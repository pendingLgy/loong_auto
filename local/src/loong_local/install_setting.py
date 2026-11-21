from loguru import logger

from loong_local.tools.filesystem import (
    CopyFileTool,
    CreateDirectoryTool,
    DeleteFileTool,
    ListDirectoryTool,
    MoveFileTool,
    ReadFileTool,
    SearchFilesTool,
    WriteFileTool,
)
from loong_local.tools.registry import GLOBAL_TOOL_REGISTRY
from loong_local.tools.shell import ShellTool

# 服务注册
SERVICE_TARGETS = [
    'loong_local.service',
]

# 依赖注入路径
WIRE_TARGETS = [
    'loong_local.api.proxy_sse_api',
    'loong_local.api.tool_handler_api',
    'loong_local.api.session_config_api',
    'loong_local.api.supplier_config_api',
]

# 允许模型调用的工具集合；新增工具时在这里注册，权限矩阵同步声明。
TOOL_CLASSES = (
    ShellTool,
    ReadFileTool,
    WriteFileTool,
    DeleteFileTool,
    ListDirectoryTool,
    SearchFilesTool,
    CreateDirectoryTool,
    MoveFileTool,
    CopyFileTool,
)


def init_tools() -> None:
    """在应用启动阶段集中显式注册所有工具；重复调用时跳过已注册项。"""
    for tool_class in TOOL_CLASSES:
        if tool_class.tool_name in GLOBAL_TOOL_REGISTRY.list_tool_names():
            continue
        GLOBAL_TOOL_REGISTRY.register_class(tool_class)

    logger.info("已成功加载并注册工具: {}", GLOBAL_TOOL_REGISTRY.list_tool_names())
