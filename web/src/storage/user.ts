import { createMemo, createSignal } from "solid-js";

import type { LoginResponse, UserInfo } from "@loong/client";

const STORAGE_KEY = "loong.web.user";
const LEGACY_SESSION_KEY = "loong.web.session";
const LEGACY_SCOPED_PREFIX = "loong.web.user:";

interface StoredUser {
  session: LoginResponse;
  savedAt: string;
}

function isLoginResponse(value: Partial<LoginResponse> | null | undefined): boolean {
  return !!value
    && typeof value.accessToken === "string" && value.accessToken.length > 0
    && typeof value.refreshToken === "string" && value.refreshToken.length > 0;
}

function parseStored(raw: string | null): LoginResponse | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredUser> | null;
    return isLoginResponse(stored?.session) ? stored!.session as LoginResponse : null;
  } catch {
    return null;
  }
}

function readStored(): LoginResponse | null {
  try {
    const current = parseStored(window.localStorage.getItem(STORAGE_KEY));
    if (current) return current;

    // 兼容旧版按服务器 ID 分开存储的会话：取第一个可用会话。
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(LEGACY_SCOPED_PREFIX)) continue;
      const legacy = parseStored(window.localStorage.getItem(key));
      if (legacy) {
        writeStored(legacy);
        window.localStorage.removeItem(key);
        return legacy;
      }
    }

    const legacySession = window.localStorage.getItem(LEGACY_SESSION_KEY);
    if (!legacySession) return null;
    const parsed = JSON.parse(legacySession) as (Partial<StoredUser> & Partial<LoginResponse>) | null;
    const value = parsed?.session ?? parsed;
    return isLoginResponse(value as Partial<LoginResponse>) ? value as LoginResponse : null;
  } catch {
    return null;
  }
}

function writeStored(value: LoginResponse): void {
  try {
    const stored: StoredUser = { session: value, savedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}

const [revision, setRevision] = createSignal(0);

/** 当前登录用户会话。 */
const userSession = createMemo<LoginResponse | null>(() => {
  revision();
  return readStored();
});

export { userSession };

/** 登录成功后保存唯一用户会话。 */
export function saveUser(value: LoginResponse): void {
  writeStored(value);
  setRevision((current) => current + 1);
}

/** 清除用户会话。 */
export function clearUser(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(LEGACY_SCOPED_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // 忽略存储异常。
  }
  setRevision((current) => current + 1);
}

/** 刷新令牌后只更新 accessToken。 */
export function updateAccessToken(token: string): void {
  const current = readStored();
  if (!current) return;
  saveUser({ ...current, accessToken: token });
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
