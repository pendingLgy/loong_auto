"""HTTP 响应 body，按接口类型拆分。"""
from .base import BaseResponse
from .status import HealthStatus, ServiceStatus

__all__ = ["BaseResponse", "HealthStatus", "ServiceStatus"]
