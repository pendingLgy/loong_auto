"""服务自身运行状态，不探测外部模型供应商。"""

from time import monotonic

from fastapi import APIRouter, Request
from loong_contracts.utis import Response
from loong_contracts.response import BaseResponse
from loong_contracts.response.status import HealthStatus, ServiceStatus

router = APIRouter(prefix="/status", tags=["服务状态"])


@router.get("/info", response_model=BaseResponse[ServiceStatus], summary="获取服务运行状态")
async def get_status(request: Request) -> BaseResponse[ServiceStatus]:
    return Response.ok(request, ServiceStatus(
        version=request.app.version,
        started_at=request.app.state.started_at,
        uptime_seconds=round(max(0, monotonic() - request.app.state.started_monotonic), 3),
    ))



@router.get("/health", response_model=BaseResponse[HealthStatus], include_in_schema=False)
async def health(request: Request):
    return Response.ok(request, HealthStatus())
