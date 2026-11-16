from enum import Enum


class GlobalMessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class GlobalMessageStatus(str, Enum):
    CONNECTED = "connected"
    HEARTBEAT = "heartbeat"

    START = "start"
    RUNNING = "running"
    TOOL_CALLING = "tool_calling"
    TOOL_APPROVAL_REQUIRED = "tool_approval_required"
    TOOL_CALLED = "tool_called"
    STOP = "stop"
