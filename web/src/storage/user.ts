import { createSignal } from "solid-js";

import type { LoginResponse, UserInfo } from "@loong/client";

/** 登录成功后的用户数据（令牌 + 用户信息），与服务器配置分开存储。 */
const STORAGE_KEY = "loong.web.user";

/** 旧版本登录会话存放位置，读取时自动迁移。 */
const LEGACY_SESSION_KEY = "loong.web.session";

interface StoredUser {
  session: LoginResponse;
  savedAt: string;
}

let needsLegacyMigration = false;

function isLoginResponse(value: Partial<LoginResponse> | null | undefined): boolean {
  return !!value
    && typeof value.accessToken === "string" && value.accessToken.length > 0
    && typeof value.refreshToken === "string" && value.refreshToken.length > 0;
}

function readStoredUser(): LoginResponse | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<StoredUser> | null;
      if (isLoginResponse(stored?.session)) {
        return stored?.session as LoginResponse;
      }
    }

    // 兼容旧版本：loong.web.session 里可能是 { session, serverUrl, savedAt } 或裸会话。
    const legacy = window.localStorage.getItem(LEGACY_SESSION_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as (Partial<StoredUser> & Partial<LoginResponse>) | null;
      const value = parsed?.session ?? parsed;
      if (isLoginResponse(value as Partial<LoginResponse>)) {
        needsLegacyMigration = true;
        return value as LoginResponse;
      }
    }
    return null;
  } catch {
    return null;
  }
}

const [userSession, setUserSessionSignal] = createSignal<LoginResponse | null>(readStoredUser());

/** 当前登录用户数据；null 表示未登录。 */
export { userSession };

/** 登录成功后保存用户数据。 */
export function saveUser(value: LoginResponse): void {
  setUserSessionSignal(value);
  try {
    const stored: StoredUser = { session: value, savedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // 存储不可用时仅保留内存态。
  }
}

export function clearUser(): void {
  setUserSessionSignal(null);
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略存储异常。
  }
}

export function currentUser(): UserInfo | null {
  return userSession()?.user ?? null;
}

export function accessToken(): string | undefined {
  return userSession()?.accessToken;
}

export function isLoggedIn(): boolean {
  return userSession() !== null;
}

// 旧数据迁移：等 signal 初始化完成后再写入新 key 并删除旧 key。
if (needsLegacyMigration) {
  const migrated = userSession();
  if (migrated) {
    saveUser(migrated);
    try {
      window.localStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      // 忽略存储异常。
    }
  }
}
