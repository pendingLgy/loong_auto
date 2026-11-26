/** 登录请求 / 响应相关的类型定义。 */

export type LoginPlatform = "web" | "electron" | "tui" | "cli";

/** 登录请求参数。 */
export interface LoginRequest {
  username: string;
  password: string;
  platform: LoginPlatform;
}

/** 注册请求参数。 */
export interface RegisterRequest {
  username: string;
  password: string;
  name?: string;
}

/** 刷新令牌请求参数。 */
export interface RefreshTokenRequest {
  refresh_token: string;
}

/** 登录用户信息。 */
export interface UserInfoResponse {
  id: string;
  tenant_id: string;
  username: string;
  name: string | null;
  role: string | null;
}

/** 登录响应（客户端领域模型）。 */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserInfoResponse;
}

/** 云端原始登录响应字段。 */
export interface RawLoginPayload {
  access_token?: unknown;
  refresh_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  user_info?: unknown;
}

/** 云端原始用户信息字段。 */
export interface RawUserPayload {
  id?: unknown;
  tenant_id?: unknown;
  username?: unknown;
  name?: unknown;
  role?: unknown;
}

/** 兼容旧命名。 */
export type LoginInput = LoginRequest;
export type LoginSession = LoginResponse;
