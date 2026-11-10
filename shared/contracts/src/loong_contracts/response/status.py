from datetime import datetime
from typing import Literal
from ..common import Contract

class ServiceStatus(Contract):
    service: Literal["loong-cloud"] = "loong-cloud"
    status: Literal["running"] = "running"
    version: str
    started_at: datetime
    uptime_seconds: float


class HealthStatus(Contract):
    status: Literal["ok"] = "ok"
