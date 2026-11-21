from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field, PlainSerializer

from loong_local.commons.constant import WorkspaceModelType


def _parse_to_int(v) -> int:
    """入参清洗：无论是 str 还是 int，都安全转为 int"""
    if isinstance(v, str):
        v = v.strip()
        if not v.isdigit():
            raise ValueError("ID 必须是合法的数字")
    return int(v)

# 定义一个全能型的 BigIntId
BigIntId = Annotated[
    int,
    BeforeValidator(_parse_to_int),  # 1. 接收时：自动把 str/int 统一转为 int
    PlainSerializer(lambda x: str(x), return_type=str)  # 2. 输出时：自动把 int 转为 str
]

class SessionConfigSaveRequest(BaseModel):
    """创建或覆盖会话配置。"""

    workspace_id: BigIntId
    workspace_mode: WorkspaceModelType = Field(default=WorkspaceModelType.READ_ONLY, description="放行模式")
    workspaces: list[str] = Field(default_factory=list, description="允许的工作目录列表")


class SessionConfigUpdateRequest(BaseModel):
    """局部编辑会话配置：只提交需要修改的字段。"""

    workspace_mode: WorkspaceModelType = Field(default=WorkspaceModelType.READ_ONLY, description="放行模式")
    workspaces: list[str] = Field(default_factory=list, description="允许的工作目录列表")
