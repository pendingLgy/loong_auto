"""本地接口统一路由注册。"""
from fastapi import APIRouter
from .health import router as health_router
from .proxy import router as proxy_router

router = APIRouter()
router.include_router(health_router)
router.include_router(proxy_router)
