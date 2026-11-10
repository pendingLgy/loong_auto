from datetime import datetime
from typing import Literal
from pydantic import Field, JsonValue
from ..common import Contract, utcnow

class Event(Contract):
    protocol_version: Literal["1.0"] = "1.0"
    id: int
    task_id: str
    type: Literal[
        "task.created", "task.running", "model.text", "tool.request",
        "tool.result", "task.completed", "task.failed", "task.cancelled",
    ]
    timestamp: datetime = Field(default_factory=utcnow)
    payload: dict[str, JsonValue] = Field(default_factory=dict)
