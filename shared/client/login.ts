import { Effect } from "effect";

/**
 * 登录相关的领域类型与 Effect 客户端。
 *
 * 界面只能访问本机网关：登录请求经 local 的 `/api/common` 转发到云端 `/api/auth/login`，
 * 不直接连接云端地址，也不在浏览器里保存除令牌以外的凭证。
 */

export type LoginPlatform = "web" | "electron";

export interface LoginInput {
  username: string;
  password: string;
  platform: LoginPlatform;
}

export interface LoginUser {
  id: string;
  tenantId: string;
  username: string;
  name: string | null;
  role: string | null;
}

export interface LoginSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: LoginUser;
}

export class LoginError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: number,
  ) {
    super(message);
    this.name = "LoginError";
  }
}

interface ApiEnvelope {
  code?: unknown;
  msg?: unknown;
  data?: unknown;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export const LOGIN_PATH = "/api/common/api/auth/login";

/** 只允许本机网关，拒绝携带账号密码去访问任意远程地址。 */
export function assertLocalGateway(origin: string): URL {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new LoginError("本地网关地址不合法");
  }
  if (!LOCAL_HOSTS.has(url.hostname) || !["http:", "https:"].includes(url.protocol)
      || url.username || url.password) {
    throw new LoginError("只能通过本地网关登录");
  }
  return url;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asMessage(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

/** 把云端信封里的 data 转成界面使用的会话；字段缺失时直接失败，避免带着空令牌进入应用。 */
export function toLoginSession(payload: unknown): LoginSession {
  const data = asRecord(payload);
  const accessToken = data?.access_token;
  const refreshToken = data?.refresh_token;
  if (typeof accessToken !== "string" || !accessToken
      || typeof refreshToken !== "string" || !refreshToken) {
    throw new LoginError("登录响应缺少令牌");
  }

  const user = asRecord(data?.user_info) ?? {};
  return {
    accessToken,
    refreshToken,
    tokenType: typeof data?.token_type === "string" ? data.token_type : "bearer",
    expiresIn: typeof data?.expires_in === "number" ? data.expires_in : 0,
    user: {
      id: String(user.id ?? ""),
      tenantId: String(user.tenant_id ?? ""),
      username: typeof user.username === "string" ? user.username : "",
      name: typeof user.name === "string" ? user.name : null,
      role: typeof user.role === "string" ? user.role : null,
    },
  };
}

export interface LoginOptions {
  /** 本地网关地址；默认取当前页面 origin（Web 由网关托管时即为网关地址）。 */
  origin?: string;
  /** 便于测试注入 fetch。 */
  fetch?: typeof fetch;
}

/** 通过本地网关登录，返回 Effect；取消 Effect 会中断请求。 */
export function loginWithLocalGateway(
  input: LoginInput,
  options: LoginOptions = {},
): Effect.Effect<LoginSession, LoginError> {
  return Effect.tryPromise({
    try: async (signal) => {
      const origin = options.origin
        ?? (typeof location === "undefined" ? "http://127.0.0.1:9528" : location.origin);
      const base = assertLocalGateway(origin);
      const send = options.fetch ?? fetch;

      const response = await send(new URL(LOGIN_PATH, base), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        redirect: "error",
        signal,
        body: JSON.stringify({
          username: input.username,
          password: input.password,
          platform: input.platform,
        }),
      });

      const envelope = await response.json().catch(() => null) as ApiEnvelope | null;
      if (!envelope) {
        throw new LoginError("登录响应不是合法 JSON", response.status);
      }
      if (response.status === 401 || envelope.code === 401) {
        throw new LoginError("用户名或密码错误", response.status, 401);
      }
      if (!response.ok || envelope.code !== 200) {
        const code = typeof envelope.code === "number" ? envelope.code : undefined;
        throw new LoginError(asMessage(envelope.msg, "登录失败"), response.status, code);
      }
      return toLoginSession(envelope.data);
    },
    catch: (cause) => cause instanceof LoginError
      ? cause
      : new LoginError(cause instanceof Error ? cause.message : String(cause)),
  });
}
