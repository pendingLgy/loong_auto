import { createSignal } from "solid-js";

/** 本地网关的唯一服务器配置。 */
export interface ServerConfig {
  /** 兼容旧界面结构；单服务器模式下固定为 default。 */
  id?: string;
  name?: string;
  serverUrl: string;
  token: string;
  connected?: boolean;
  checkedAt?: string;
  createdAt?: string;
}

export interface ServerConfigInput {
  name?: string;
  serverUrl: string;
  token: string;
  connected?: boolean;
  checkedAt?: string;
  createdAt?: string;
}

const STORAGE_KEY = "loong.web.server-config";

function normalizeConfig(value: unknown): ServerConfig | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Partial<ServerConfig>;
  if (typeof item.serverUrl !== "string" || !item.serverUrl.trim()) return null;
  if (typeof item.token !== "string") return null;

  return {
    id: "default",
    name: typeof item.name === "string" ? item.name : undefined,
    serverUrl: item.serverUrl.trim(),
    token: item.token,
    connected: typeof item.connected === "boolean" ? item.connected : undefined,
    checkedAt: typeof item.checkedAt === "string" ? item.checkedAt : undefined,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
  };
}

function readStoredConfig(): ServerConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);

    // 兼容旧版 { servers: [...] }：只保留第一个服务器。
    if (typeof parsed === "object" && parsed !== null && "servers" in parsed) {
      const servers = (parsed as { servers?: unknown }).servers;
      if (Array.isArray(servers)) {
        for (const item of servers) {
          const config = normalizeConfig(item);
          if (config) return config;
        }
      }
      return null;
    }

    return normalizeConfig(parsed);
  } catch {
    return null;
  }
}

const [config, setConfig] = createSignal<ServerConfig | null>(readStoredConfig());

function persist(next: ServerConfig | null): void {
  try {
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}

/** 当前唯一服务器配置。 */
export function serverConfig(): ServerConfig | null {
  return config();
}

/** 是否已配置服务器。 */
export function isServerConfigured(): boolean {
  return config() !== null;
}

/** 保存唯一服务器配置。 */
export function saveServerConfig(value: ServerConfigInput): ServerConfig {
  const next: ServerConfig = {
    id: "default",
    name: value.name?.trim() || undefined,
    serverUrl: value.serverUrl.trim(),
    token: value.token,
    connected: value.connected,
    checkedAt: value.checkedAt,
    createdAt: value.createdAt ?? config()?.createdAt ?? new Date().toISOString(),
  };
  setConfig(next);
  persist(next);
  return next;
}

/** 更新服务器连通状态。 */
export function updateServerStatus(connected: boolean): void {
  const current = config();
  if (!current) return;
  const next = {
    ...current,
    connected,
    checkedAt: new Date().toISOString(),
  };
  setConfig(next);
  persist(next);
}

/** 清除唯一服务器配置。 */
export function clearServerConfig(): void {
  setConfig(null);
  persist(null);
}
