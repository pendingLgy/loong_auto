import { defineEndpoint } from "../core";
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RegisterRequest,
  UserInfo,
} from "../types";

export const AUTH_ENDPOINTS = {
  login: defineEndpoint<LoginRequest, LoginResponse>(
    "POST",
    "/api/cloud/common/api/auth/login",
  ),
  register: defineEndpoint<RegisterRequest, UserInfo>(
    "POST",
    "/api/cloud/common/api/auth/register",
  ),
  refreshToken: defineEndpoint<RefreshTokenRequest, string>(
    "POST",
    "/api/cloud/common/api/auth/refresh_token",
  ),
  me: defineEndpoint<void, UserInfo>(
    "GET",
    "/api/cloud/common/api/auth/me",
  ),
  logout: defineEndpoint<void, void>(
    "POST",
    "/api/cloud/common/api/auth/logout",
  ),
} as const;

/** 认证接口。 */
export interface AuthApi {
  login: typeof AUTH_ENDPOINTS.login;
  register: typeof AUTH_ENDPOINTS.register;
  refreshToken: typeof AUTH_ENDPOINTS.refreshToken;
  me: typeof AUTH_ENDPOINTS.me;
  logout: typeof AUTH_ENDPOINTS.logout;
}


