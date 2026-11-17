"""工具只处理执行，不依赖 HTTP 或界面。"""
from abc import ABC, abstractmethod
from pathlib import Path
from typing import ClassVar, Generic, TypeVar
from pydantic import BaseModel
from loong_contracts.agent.models import ToolDefinition

InputT = TypeVar("InputT", bound=BaseModel)
OutputT = TypeVar("OutputT", bound=BaseModel)


class ABSTool(ABC, Generic[InputT, OutputT]):
    tool_name: ClassVar[str]
    description: ClassVar[str]
    request_model: type[InputT]

    def __init__(self, workspace: Path):
        self.workspace = workspace.resolve(strict=True)
        if not self.workspace.is_dir():
            raise ValueError("工作区必须是目录")

    @classmethod
    def definition(cls) -> ToolDefinition:
        return ToolDefinition(name=cls.tool_name, description=cls.description, location="remote",
                              parameters=cls.request_model.model_json_schema())

    def is_dangerous(self, request: InputT) -> bool:
        return True

    def approval_details(self, request: InputT) -> tuple[str, str]:
        return request.model_dump_json(), "工具操作需要授权"

    @abstractmethod
    async def execute(self, request: InputT, *, approved: bool = False) -> OutputT: ...
