import { createSignal } from "solid-js";

/** 服务器配置：本地网关地址与 security_token。 */
export interface ServerConfig {
  serverUrl: string;
  token: string;
}

const STORAGE_KEY = "loong.web.server-config";

function readStoredConfig(): ServerConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ServerConfig> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.serverUrl !== "string" || !parsed.serverUrl.trim()) return null;
    if (typeof parsed.token !== "string") return null;
    return { serverUrl: parsed.serverUrl, token: parsed.token };
  } catch {
    return null;
  }
}

const [serverConfig, setServerConfigSignal] = createSignal<ServerConfig | null>(readStoredConfig());

/** 当前服务器配置；null 表示尚未配置或未通过校验。 */
export { serverConfig };

/** 健康检查通过后保存服务器配置。 */
export function saveServerConfig(value: ServerConfig): void {
  setServerConfigSignal(value);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // 存储不可用时仅当前页面生效。
  }
}

export function clearServerConfig(): void {
  setServerConfigSignal(null);
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略存储异常。
  }
}

/** 是否已完成服务器配置（决定先进入配置页还是登录页）。 */
export function isServerConfigured(): boolean {
  return serverConfig() !== null;
}
