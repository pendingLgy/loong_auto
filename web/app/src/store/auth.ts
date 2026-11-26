import type { UserInfoResponse } from "@loong/web-api";

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserInfoResponse;
  user_token: string;
}

const STORAGE_KEY = "loong.web.auth";

/** 读取持久化的登录会话。 */
export function readAuthSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession> | null;
    if (
      typeof parsed?.access_token !== "string"
      || !parsed.access_token
      || typeof parsed.refresh_token !== "string"
      || typeof parsed.user !== "object"
      || parsed.user === null
      || typeof parsed.user_token !== "string"
      || !parsed.user_token
    ) {
      return null;
    }
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      token_type: typeof parsed.token_type === "string" ? parsed.token_type : "bearer",
      expires_in: typeof parsed.expires_in === "number" ? parsed.expires_in : 0,
      user: parsed.user as UserInfoResponse,
      user_token: parsed.user_token,
    };
  } catch {
    return null;
  }
}

/** 保存登录会话。 */
export function saveAuthSession(session: AuthSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}

/** 清除登录会话。 */
export function clearAuthSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}
