from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ServiceStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service: Literal["loong-cloud"] = "loong-cloud"
    status: Literal["running"] = "running"
    version: str
    started_at: datetime
    uptime_seconds: float


class HealthStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["ok"] = "ok"
