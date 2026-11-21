from enum import Enum

from pydantic import BaseModel


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ExecutionStatus(str, Enum):
    WAITING_APPROVAL = "WAITING_APPROVAL"
    READY = "READY"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    UNKNOWN = "UNKNOWN"


class SubmissionStatus(str, Enum):
    PENDING = "PENDING"
    SENDING = "SENDING"
    DELIVERED = "DELIVERED"
    UNKNOWN = "UNKNOWN"


class ToolCallSpec(BaseModel):
    call_id: str
    tool_name: str
    arguments_json: str
    args_digest: str
    requires_approval: bool
    workspace: str | None = None
    risk_reason: str | None = None


class WorkspaceModelType(str,Enum):
    """
    >>>   from loong_local.tools.security import WorkspaceMode
    """
    READ_ONLY = "read_only"  # 仅查看
    WORKSPACE_WRITE = "workspace_write"  # 工作区内修改，高危操作需要人工确认
    FULL = "full"  # 完全权限，不再逐次人工确认

