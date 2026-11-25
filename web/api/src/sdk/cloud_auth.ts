import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RegisterRequest,
  UserInfo,
} from "../types";
import type { ApiEndpoint } from "../config";

export interface LoginEndpoint
  extends ApiEndpoint<LoginRequest, LoginResponse, "POST", "/api/cloud/common/api/auth/login"> {}

export interface RegisterEndpoint
  extends ApiEndpoint<RegisterRequest, UserInfo, "POST", "/api/cloud/common/api/auth/register"> {}

export interface RefreshTokenEndpoint
  extends ApiEndpoint<RefreshTokenRequest, string, "POST", "/api/cloud/common/api/auth/refresh_token"> {}

export interface MeEndpoint
  extends ApiEndpoint<void, UserInfo, "GET", "/api/cloud/common/api/auth/me"> {}

export interface LogoutEndpoint
  extends ApiEndpoint<void, void, "POST", "/api/cloud/common/api/auth/logout"> {}

/** 认证接口。 */
export interface AuthApi {
  login: LoginEndpoint;
  register: RegisterEndpoint;
  refreshToken: RefreshTokenEndpoint;
  me: MeEndpoint;
  logout: LogoutEndpoint;
}
