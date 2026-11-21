
"""
    领域异常基类，统一上层捕获入口。
"""

from __future__ import annotations

from httpx import Headers


class BaseError(Exception):
    """所有领域异常的基类。"""

class ParserError(Exception):
    """转换异常。"""

class ConfigError(BaseError):
    """配置缺失或非法。"""

class DataError(BaseError):
    """数据校验失败。"""

class OptionalDependencyError(BaseError):
    """可选依赖未安装。"""


class StorageError(BaseError):
    """存储读写失败。"""


class ApprovalConflictError(Exception):
    """审批状态已变更或并发冲突"""


class ApprovalNotFoundError(Exception):
    """审批不存在或无权访问"""


class ToolExecuteError(Exception):
    """工具执行异常"""

class CloudHttpError(Exception):
    """调用Cloud服务异常"""

    def __init__(self, status: int, message: str, headers:Headers) -> None:
        self.status = status
        self.message = message
        self.headers = headers
