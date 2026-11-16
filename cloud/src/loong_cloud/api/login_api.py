from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Request

from loong_contracts.utis import Response
from loong_cloud.storage.token_service import TokenService
from loong_cloud.storage.user_store import UserStore
from loong_contracts.request.login import RegisterRequest, RefreshTokenRequest, LoginRequest
from loong_contracts.response import BaseResponse
from loong_contracts.response.login import LoginResponse, UserInfoResponse

router = APIRouter(prefix="/auth", tags=["用户认证"])


@router.post("/refresh_token", response_model=BaseResponse[LoginResponse])
@inject
async def refresh_token(request: Request, body: RefreshTokenRequest,
                        user_store: UserStore = Depends(Provide["UserStore"]),
                        token_service: TokenService = Depends(Provide["TokenService"])):

    tokens = await token_service.refresh_access_token(body.refresh_token, user_store)
    return Response.ok(request, tokens)


@router.post("/register", response_model=BaseResponse[UserInfoResponse])
@inject
async def register(request: Request, body: RegisterRequest,
                   user_store: UserStore = Depends(Provide["UserStore"])):
    user = await user_store.register(request.state.tenant_id, body.username, body.password, body.name)
    return Response.ok(request, user)


@router.post("/login", response_model=BaseResponse[LoginResponse])
@inject
async def login(request: Request, body: LoginRequest,
                user_store: UserStore = Depends(Provide["UserStore"]),
                token_service: TokenService = Depends(Provide["TokenService"])):
    user = await user_store.login(
        request.state.tenant_id, body.username, body.password,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    data = await token_service.issue(user, body.platform)
    return Response.ok(request, data=data)


@router.get("/me", response_model=BaseResponse[UserInfoResponse])
@inject
async def get_user_info(request: Request, user_store: UserStore = Depends(Provide["UserStore"])):
    user = await user_store.get_user_info(request.state.tenant_id, request.state.identity.id)
    return Response.ok(request, user)


@router.post("/logout", response_model=BaseResponse[None])
@inject
async def logout(request: Request,
                 token_service: TokenService = Depends(Provide["TokenService"]),
                 user_store: UserStore = Depends(Provide["UserStore"])):
    await token_service.logout(request.state.access_token)
    await user_store.logout(
        request.state.identity,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return Response.ok(request)
