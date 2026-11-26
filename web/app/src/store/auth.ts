import type { UserInfo } from "@loong/web-api";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo;
}

const STORAGE_KEY = "loong.web.auth";

/** 读取持久化的登录会话。 */
export function readAuthSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession> | null;
    if (
      typeof parsed?.accessToken !== "string"
      || !parsed.accessToken
      || typeof parsed.refreshToken !== "string"
      || typeof parsed.user !== "object"
      || parsed.user === null
    ) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      tokenType: typeof parsed.tokenType === "string" ? parsed.tokenType : "bearer",
      expiresIn: typeof parsed.expiresIn === "number" ? parsed.expiresIn : 0,
      user: parsed.user as UserInfo,
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
