"""统一注册业务路由；新增接口按领域拆分模块。"""

from fastapi import APIRouter

from loong_cloud.api.events_api import router as events_router
from loong_cloud.api.login_api import router as login_router
from loong_cloud.api.message_api import router as message_router
from loong_cloud.api.session_api import router as session_router
from loong_cloud.api.status import router as status_router
from loong_cloud.api.supplier_api import router as supplier_router
from loong_cloud.api.workspace_api import router as workspace_router

router = APIRouter(prefix="/api")
router.include_router(status_router)
router.include_router(supplier_router)
router.include_router(login_router)
router.include_router(message_router)
router.include_router(events_router)
router.include_router(workspace_router)
router.include_router(session_router)
