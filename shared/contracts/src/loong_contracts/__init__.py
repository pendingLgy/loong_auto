"""按接口类型组织的公共协议。"""

from .events import Event
from .response import BaseResponse, ServiceStatus, HealthStatus

__all__ = ["BaseResponse", "Event",
           "ServiceStatus", "HealthStatus"]
