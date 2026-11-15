"""统一注册业务路由；新增接口按领域拆分模块。"""

from fastapi import APIRouter

from .status import router as status_router
from .tasks import router as tasks_router
from .login_api import router as login_router
from .message_api import router as message_router
from .events_api import router as events_router

router = APIRouter(prefix="/api")
router.include_router(status_router)
router.include_router(tasks_router)
router.include_router(login_router)
router.include_router(message_router)
router.include_router(events_router)
