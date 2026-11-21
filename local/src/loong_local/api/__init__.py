"""具体消息/SSE/工具审批/会话配置路由先于通配转发路由。"""
from fastapi import APIRouter

from loong_local.api.health_api import router as health_router
from loong_local.api.proxy_common_api import router as common_router
from loong_local.api.proxy_message_api import router as message_router
from loong_local.api.proxy_sse_api import router as sse_router
from loong_local.api.session_config_api import router as session_config_router
from loong_local.api.supplier_config_api import router as supplier_config_router
from loong_local.api.tool_handler_api import router as tool_router

router = APIRouter(prefix="/api")

router.include_router(session_config_router)
router.include_router(health_router)
router.include_router(supplier_config_router)
router.include_router(tool_router)

cloud_router = APIRouter(prefix="/cloud",tags=["cloud"])
cloud_router.include_router(message_router)
cloud_router.include_router(sse_router)
cloud_router.include_router(common_router)

router.include_router(cloud_router)


