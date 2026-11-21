"""JWT 签名与缓存会话；缓存仅保存令牌指纹，不保存原始凭证。"""

import hashlib
import secrets
import time
from typing import Any

import jwt
from fastapi import HTTPException
from loong_contracts.request.login import LoginPlatform
from loong_contracts.response.login import LoginResponse, UserInfoResponse
from starlette import status

from loong_cloud.cache import CacheProxy
from loong_cloud.config import GlobalConfig
from loong_cloud.constant.cache_key import ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, TOKEN_SESSION_KEY
from loong_cloud.core.logging import log_exception


class TokenService:
    def __init__(self, config: GlobalConfig, cache: CacheProxy):
        self.config = config.token_config
        self.cache = cache

    @staticmethod
    def _fingerprint(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def _encode(self, jti: str, user_id: int, kind: str,  tenant_id:int, platform: str, ttl: int) -> str:
        now = int(time.time())

        # 严格遵循 JWT 标准字段与业务扩展字段
        payload = {
            # --- 1. RFC 7519 官方标准字段（用于全局校验、时效与身份识别） ---
            "iss": self.config.issuer,  # 签发者
            "sub": str(user_id),  # 主题（用户 ID）
            "iat": now,  # 签发时间
            "exp": now + ttl,  # 过期时间
            "jti": jti,  # JWT 唯一标识（用于注销与安全审计）

            # --- 2. 业务必需的自定义扩展字段（用于多端与权限控制） ---
            "type": kind,  # 令牌类型 ("access" / "refresh")
            "tenant_id": tenant_id,  # 令牌类型 ("access" / "refresh")
            "platform": platform  # 登录平台 ("web", "cli", "tui", "electron")
        }

        token = jwt.encode(
            payload,
            self.config.secret,
            algorithm="HS256"
        )

        return token

    def _jwt_decode(self, refresh_token: str) -> tuple[Any, Any, Any, Any, Any, Any]:
        payload = jwt.decode(
            refresh_token,
            self.config.secret,
            algorithms=["HS256"],
            issuer=self.config.issuer,
            options={
                "require": [
                    "iss",  # 签发者检查
                    "sub",  # 主题检查
                    "iat",  # 签发时间检查
                    "exp",  # 过期时间检查 (自动校验是否超时)
                    "jti",  # 唯一身份标识检查
                    "type",  # 令牌类型检查
                    "tenant_id",  # 租户id
                    "platform"  # 登录平台检查
                ]
            }
        )

        user_id = int(payload["sub"])
        jti = payload["jti"]
        type = payload["type"]
        tenant_id = int(payload["tenant_id"])
        platform = payload["platform"]

        return jti, user_id, tenant_id, type, platform, payload

    async def issue(self, user: UserInfoResponse, platform: LoginPlatform = "web") -> LoginResponse:
        if platform not in ("web", "cli", "tui", "electron"):
            raise ValueError("不支持的登录平台")

        user_info = user.model_dump(mode="json", include={"id", "tenant_id", "username", "name", "role"})
        user_id = user.id
        tenant_id = user.tenant_id
        jti = secrets.token_hex(24)

        access_token = self._encode(jti=jti, user_id=user_id, kind="access", platform=platform, tenant_id=tenant_id,
                                    ttl=self.config.access_ttl)
        refresh_token = self._encode(jti=jti, user_id=user_id, kind="refresh", platform=platform, tenant_id=tenant_id,
                                     ttl=self.config.access_ttl)

        session_key = TOKEN_SESSION_KEY.format(user_id=user_id, jti=jti)
        access_key = ACCESS_TOKEN_KEY.format(user_id=user_id, jti=jti)
        refresh_key = REFRESH_TOKEN_KEY.format(user_id=user_id, jti=jti)

        try:
            await self.cache.set(
                session_key,
                dict(user_info=user_info, jti=jti),
                ttl=max(self.config.access_ttl, self.config.refresh_ttl))

            await self.cache.set(
                access_key,
                dict(token=access_token, jti=jti),
                ttl=self.config.access_ttl)

            await self.cache.set(
                refresh_key,
                dict(token=access_token, jti=jti),
                ttl=self.config.refresh_ttl)

        except Exception:
            await self.remove_cache_keys(access_key, refresh_key, session_key)
            raise

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=self.config.access_ttl,
            user_info=user_info,
        )

    async def authenticate(self, access_token: str) -> UserInfoResponse:

        try:
            jti, user_id, tenant_id, type, platform, payload = self._jwt_decode(access_token)

            if type != "access" or not isinstance(jti, str):
                raise ValueError("invalid token type")

            if platform not in ("web", "cli", "tui", "electron"):
                raise ValueError("invalid platform")

        except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "令牌无效或已过期") from exc

        access_key = ACCESS_TOKEN_KEY.format(user_id=user_id, jti=jti)
        exists = await self.cache.exists(access_key)
        if not exists:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "令牌无效或已过期")

        session_key = TOKEN_SESSION_KEY.format(user_id=user_id, jti=jti)
        session = await self.cache.get(session_key)
        if session is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "令牌无效或已过期")

        return UserInfoResponse.model_validate(session["user_info"])

    async def refresh_access_token(self, refresh_token: str, user_store) -> LoginResponse:
        """通过 refresh token 定位 refresh_key，保留其原有有效期。"""
        try:
            jti, user_id, tenant_id, type, platform, payload = self._jwt_decode(refresh_token)

            if type != "refresh" or not isinstance(jti, str):
                raise ValueError("invalid token type")

            if platform not in ("web", "cli", "tui", "electron"):
                raise ValueError("invalid platform")

        except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "刷新令牌无效或已过期") from exc

        access_key = ACCESS_TOKEN_KEY.format(user_id=user_id, jti=jti)
        refresh_key = REFRESH_TOKEN_KEY.format(user_id=user_id, jti=jti)
        session_key = TOKEN_SESSION_KEY.format(user_id=user_id, jti=jti)

        exists = await self.cache.exists(refresh_key)
        if not exists:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "刷新令牌无效或已过期")

        user = await user_store.get_user_info(tenant_id,user_id)

        await self.remove_cache_keys(access_key, refresh_key, session_key)

        user_info = await self.issue(user, platform)

        return user_info

    async def logout(self, access_token: str):

        try:
            jti, user_id, tenant_id, type, platform, payload = self._jwt_decode(access_token)
        except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "令牌无效或已过期") from exc

        session_key = TOKEN_SESSION_KEY.format(user_id=user_id, jti=jti)
        access_key = ACCESS_TOKEN_KEY.format(user_id=user_id, jti=jti)
        refresh_key = REFRESH_TOKEN_KEY.format(user_id=user_id, jti=jti)

        await self.remove_cache_keys(access_key, refresh_key, session_key)

    async def remove_cache_keys(self, access_key: str, refresh_key: str, session_key: str):
        try:
            await self.cache.delete(access_key)
        except Exception as e:
            log_exception(e, "remove access_key error")

        try:
            await self.cache.delete(refresh_key)
        except Exception as e:
            log_exception(e, "remove refresh_key error")

        try:
            await self.cache.delete(session_key)
        except Exception as e:
            log_exception(e, "remove session_key error")
