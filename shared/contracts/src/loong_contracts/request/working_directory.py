from pydantic import BaseModel, Field


class CreateWorkingDirectoryRequest(BaseModel):
    """创建工作目录。"""

    name: str = Field(max_length=256, description="工作目录名称")
    path: list[str] = Field(min_length=1, description="工作目录路径列表")


class UpdateWorkingDirectoryRequest(BaseModel):
    """更新工作目录。"""

    name: str = Field(max_length=256, description="工作目录名称")
    path: list[str] = Field(min_length=1, description="工作目录路径列表")
