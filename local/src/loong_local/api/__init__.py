"""具体消息/SSE/工具审批/会话配置路由先于通配转发路由。"""
from fastapi import APIRouter

from .proxy_common_api import router as common_router
from .proxy_message_api import router as message_router
from .proxy_sse_api import router as sse_router
from .session_config_api import router as session_config_router
from .tool_handler_api import router as tool_router

router = APIRouter(prefix="/api")
router.include_router(message_router)
router.include_router(sse_router)
router.include_router(tool_router)
router.include_router(session_config_router)
router.include_router(common_router)
