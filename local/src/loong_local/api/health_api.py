from fastapi import APIRouter, Request
from loong_contracts.response import BaseResponse
from loong_contracts.utils import Response

router = APIRouter(prefix="/health", tags=["健康检查"])

@router.get("/security_token", response_model=BaseResponse)
async def resume_tool_endpoint(
        request: Request):

    security_token = request.headers.get("x-security-token")
    if security_token != request.app.state.security_token:
        return Response.fail(request, msg="security_token 错误")

    return Response.ok(request,msg="连接成功")
