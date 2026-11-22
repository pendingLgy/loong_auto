import { createMemo, createSignal } from "solid-js";

import type { LoginResponse, UserInfo } from "@loong/client";

import { activeServerId } from "./server_config";

/** 按服务器 ID 分开存储登录信息。 */
const STORAGE_KEY_PREFIX = "loong.web.user";
const LEGACY_USER_KEY = "loong.web.user";
const LEGACY_SESSION_KEY = "loong.web.session";

interface StoredUser {
  session: LoginResponse;
  savedAt: string;
}

function storageKey(serverId: string): string {
  return `${STORAGE_KEY_PREFIX}:${serverId}`;
}

function isLoginResponse(value: Partial<LoginResponse> | null | undefined): boolean {
  return !!value
    && typeof value.accessToken === "string" && value.accessToken.length > 0
    && typeof value.refreshToken === "string" && value.refreshToken.length > 0;
}

function readStoredValue(key: string): LoginResponse | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredUser> | null;
    return isLoginResponse(stored?.session) ? stored!.session as LoginResponse : null;
  } catch {
    return null;
  }
}

function readLegacyValue(): LoginResponse | null {
  const stored = readStoredValue(LEGACY_USER_KEY);
  if (stored) return stored;

  try {
    const raw = window.localStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as (Partial<StoredUser> & Partial<LoginResponse>) | null;
    const value = parsed?.session ?? parsed;
    return isLoginResponse(value as Partial<LoginResponse>) ? value as LoginResponse : null;
  } catch {
    return null;
  }
}

function writeStoredValue(serverId: string, value: LoginResponse): void {
  try {
    const stored: StoredUser = { session: value, savedAt: new Date().toISOString() };
    window.localStorage.setItem(storageKey(serverId), JSON.stringify(stored));
  } catch {
    // 存储不可用时仅保留内存态。
  }
}

function removeLegacyValues(): void {
  try {
    window.localStorage.removeItem(LEGACY_USER_KEY);
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // 忽略存储异常。
  }
}

function readUser(serverId: string): LoginResponse | null {
  const scoped = readStoredValue(storageKey(serverId));
  if (scoped) return scoped;

  // 兼容旧版本单一登录信息：迁移到当前服务器后删除旧 key。
  const legacy = readLegacyValue();
  if (!legacy) return null;

  writeStoredValue(serverId, legacy);
  removeLegacyValues();
  return legacy;
}

const [revision, setRevision] = createSignal(0);

/** 当前服务器的登录用户数据；null 表示该服务器未登录。 */
const userSession = createMemo<LoginResponse | null>(() => {
  revision();
  const serverId = activeServerId();
  return serverId ? readUser(serverId) : null;
});

export { userSession };

/** 读取指定服务器的登录会话，用于按服务器隔离请求。 */
export function getUserSession(serverId: string): LoginResponse | null {
  revision();
  return serverId ? readUser(serverId) : null;
}

/** 登录成功后保存当前服务器（或指定服务器）的用户数据。 */
export function saveUser(value: LoginResponse, serverId?: string): void {
  const id = serverId ?? activeServerId();
  if (!id) return;

  writeStoredValue(id, value);
  setRevision((current) => current + 1);
}

/** 清除当前服务器（或指定服务器）的用户数据。 */
export function clearUser(serverId?: string): void {
  const id = serverId ?? activeServerId();
  if (id) {
    try {
      window.localStorage.removeItem(storageKey(id));
    } catch {
      // 忽略存储异常。
    }
  }
  setRevision((current) => current + 1);
}

/** 刷新令牌成功后只更新 accessToken，保留 refreshToken 与用户信息。 */
export function updateAccessToken(token: string, serverId?: string): void {
  const id = serverId ?? activeServerId();
  if (!id) return;
  const current = readUser(id);
  if (!current) return;
  saveUser({ ...current, accessToken: token }, id);
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
