"""上下文只绑定到单次 Request；凭证不持久化。"""
from dataclasses import dataclass, field
from httpx import Headers

from loong_cloud_client import CloudClient


@dataclass(frozen=True)
class SSEContext:
    client_id: str
    local_request_id: str
    authorization: str = field(repr=False)
    tenant_id: str | None = None
    user_id: str | None = None
    platform: str | None = None

    cloud_client: CloudClient | None = None

    def headers(self) -> Headers:
        headers = Headers()
        for name, value in (("Authorization", self.authorization), ("X-Client-ID", self.client_id),
                            ("X-Local-Request-ID", self.local_request_id), ("X-Platform", self.platform)):
            if value:
                headers[name] = value
        return headers

