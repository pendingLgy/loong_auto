from datetime import datetime, timezone
from uuid import uuid4
from pydantic import BaseModel, ConfigDict

def identifier() -> str:
    return uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")

