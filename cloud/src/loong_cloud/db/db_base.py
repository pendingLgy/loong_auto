from abc import ABC, abstractmethod
from typing import List, Any


class BaseDB(ABC):

    @abstractmethod
    async def start(self):
        """connect database"""

    @abstractmethod
    async def table_miss(self) -> List[Any]:
        """check if table exists"""

    @abstractmethod
    async def close(self) -> List[Any]:
        """close database"""


