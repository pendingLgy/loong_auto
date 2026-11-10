from fastapi import APIRouter, Request

from loong_cloud.common.response import Response
from loong_contracts.response import BaseResponse

router = APIRouter(prefix="/tasks", tags=["任务"])


@router.get("/demo", response_model=BaseResponse[dict[str, str]], summary="任务接口示例")
async def demo(request: Request, ):
    return Response.ok(request, {"message": "tasks demo"})
