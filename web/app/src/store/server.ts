export interface ServerConfig {
  url: string;
  security_token: string;
}

const STORAGE_KEY = "loong.web.server-config";
export const DEFAULT_SERVER_URL = "http://127.0.0.1:9528";

/** 读取持久化的客户端配置。 */
export function readServerConfig(): ServerConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ServerConfig> | null;
    const url = typeof parsed?.url === "string" ? parsed.url.trim() : "";
    if (!url) return null;
    return {
      url,
      security_token: typeof parsed?.security_token === "string"
        ? parsed.security_token
        : "",
    };
  } catch {
    return null;
  }
}

/** 保存客户端配置并返回规范化结果。 */
export function saveServerConfig(config: ServerConfig): ServerConfig {
  const normalized = {
    url: config.url.trim() || DEFAULT_SERVER_URL,
    security_token: config.security_token.trim(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // 存储不可用时由调用方保留内存状态。
  }
  return normalized;
}

/** 清除持久化的客户端配置。 */
export function clearServerConfig(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 存储不可用时无需额外处理。
  }
}
