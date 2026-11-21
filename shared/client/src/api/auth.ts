import { Effect } from "effect";

import { requestJson, type HttpClientOptions } from "../http";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import type {
  LoginRequest,
  LoginResponse,
  RawLoginPayload,
  RawUserPayload,
  RegisterRequest,
  UserInfo,
} from "../types";
import { ClientError } from "../types/errors";

/** AuthApi 复用 HTTP 层配置。 */
export type AuthApiOptions = HttpClientOptions;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** 云端原始登录响应 → 客户端领域模型。 */
export function toLoginResponse(
  payload: unknown,
  locale: Locale = DEFAULT_LOCALE,
): LoginResponse {
  const data = asRecord(payload);
  const accessToken = data?.access_token;
  const refreshToken = data?.refresh_token;
  if (typeof accessToken !== "string" || !accessToken
      || typeof refreshToken !== "string" || !refreshToken) {
    throw new ClientError(
      translate(locale, "client.errors.missingTokens", "登录响应缺少令牌"),
    );
  }

  const user = asRecord(data?.user_info) ?? {};
  return {
    accessToken,
    refreshToken,
    tokenType: typeof data?.token_type === "string" ? data.token_type : "bearer",
    expiresIn: typeof data?.expires_in === "number" ? data.expires_in : 0,
    user: {
      id: asText(user.id),
      tenantId: asText(user.tenant_id),
      username: asText(user.username),
      name: asNullableText(user.name),
      role: asNullableText(user.role),
    },
  };
}

/** 云端原始用户信息 → 客户端领域模型。 */
export function toUserInfo(payload: unknown): UserInfo {
  const user = asRecord(payload) ?? {};
  return {
    id: asText(user.id),
    tenantId: asText(user.tenant_id),
    username: asText(user.username),
    name: asNullableText(user.name),
    role: asNullableText(user.role),
  };
}

/** 认证接口：登录、当前用户、退出。HTTP 细节由 `../http` 负责。 */
export class AuthApi {
  constructor(private readonly options: AuthApiOptions) {}

  login(request: LoginRequest): Effect.Effect<LoginResponse, ClientError> {
    return requestJson<RawLoginPayload>(this.options, "/api/cloud/common/api/auth/login", {
      method: "POST",
      body: request,
    }).pipe(Effect.map((payload) => toLoginResponse(payload, this.options.locale)));
  }

  register(request: RegisterRequest): Effect.Effect<UserInfo, ClientError> {
    return requestJson<RawUserPayload>(this.options, "/api/cloud/common/api/auth/register", {
      method: "POST",
      body: request,
    }).pipe(Effect.map((payload) => toUserInfo(payload)));
  }

  me(): Effect.Effect<UserInfo, ClientError> {
    return requestJson<RawUserPayload>(this.options, "/api/cloud/common/api/auth/me")
      .pipe(Effect.map((payload) => toUserInfo(payload)));
  }

  logout(): Effect.Effect<void, ClientError> {
    return requestJson<unknown>(this.options, "/api/cloud/common/api/auth/logout", { method: "POST" })
      .pipe(Effect.map(() => undefined));
  }
}
