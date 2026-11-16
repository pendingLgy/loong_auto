"""本地网关健康检查。"""
from fastapi import APIRouter

router = APIRouter(prefix="/local/v1", tags=["本地状态"])


@router.get("/health")
async def health():
    return {"status": "ok", "capabilities": ["http_proxy", "sse_proxy"], "implementation": "gateway"}
