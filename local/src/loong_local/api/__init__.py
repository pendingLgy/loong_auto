"""具体消息/SSE 路由先于通配转发路由。"""
from fastapi import APIRouter
from .proxy_message_api import router as message_router
from .proxy_sse_api import router as sse_router
from .proxy_common_api import router as common_router

router = APIRouter()
router.include_router(message_router)
router.include_router(sse_router)
router.include_router(common_router)
