import { createSignal } from "solid-js";

export interface ServerConfig {
  url: string;
  securityToken: string;
}

const STORAGE_KEY = "loong.web.server-config";
const DEFAULT_SERVER_URL = "http://127.0.0.1:9528";

function readServerConfig(): ServerConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ServerConfig> | null;
    const url = typeof parsed?.url === "string" ? parsed.url.trim() : "";
    if (!url) return null;
    return {
      url,
      securityToken: typeof parsed?.securityToken === "string"
        ? parsed.securityToken
        : "",
    };
  } catch {
    return null;
  }
}

const initial = readServerConfig();
const [serverUrl, setServerUrlSignal] = createSignal(
  initial?.url ?? DEFAULT_SERVER_URL,
);
const [securityToken, setSecurityTokenSignal] = createSignal(
  initial?.securityToken ?? "",
);
const [serverConfigured, setServerConfigured] = createSignal(initial !== null);

export {
  DEFAULT_SERVER_URL,
  securityToken,
  serverConfigured,
  serverUrl,
};

/** 清除客户端配置。 */
export function clearServerConfig(): void {
  setServerUrlSignal(DEFAULT_SERVER_URL);
  setSecurityTokenSignal("");
  setServerConfigured(false);
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}

/** 保存客户端配置并持久化。 */
export function saveServerConfig(config: ServerConfig): void {
  const url = config.url.trim() || DEFAULT_SERVER_URL;
  const token = config.securityToken.trim();
  setServerUrlSignal(url);
  setSecurityTokenSignal(token);
  setServerConfigured(true);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      url,
      securityToken: token,
    }));
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}
