"""上下文只绑定到单次 Request；凭证不持久化。"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from httpx import Headers

from loong_cloud_client import CloudClient
from loong_local.tools.security import WorkspacePolicy


@dataclass(frozen=True)
class SSEContext:
    client_id: str
    local_request_id: str
    authorization: str = field(repr=False)
    tenant_id: str | None = None
    user_id: str | None = None
    platform: str | None = None

    # 多个工作空间
    workspaces: List[Path] = field(default_factory=lambda: [Path(r"F:\workspace\code\python\loong_auto")])
    # 变更类操作默认拒绝：写/删/执行需按配置显式放开。
    policy: WorkspacePolicy = field(default_factory=WorkspacePolicy)

    cloud_client: CloudClient | None = None

    def headers(self) -> Headers:
        headers = Headers()
        for name, value in (("Authorization", self.authorization), ("X-Client-ID", self.client_id),
                            ("X-Local-Request-ID", self.local_request_id), ("X-Platform", self.platform)):
            if value:
                headers[name] = value
        return headers
