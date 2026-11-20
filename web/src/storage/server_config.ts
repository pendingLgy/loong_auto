import { createSignal } from "solid-js";

/** 单个服务器配置：本地网关地址、security_token 与连通状态。 */
export interface ServerConfig {
  /** 服务器配置 id，用于选择与更新。 */
  id: string;
  /** 可选的显示名称。 */
  name?: string;
  serverUrl: string;
  token: string;
  /** 最近一次连通性检查是否成功；undefined 表示尚未检查。 */
  connected?: boolean;
  /** 最近一次连通性检查时间（ISO）。 */
  checkedAt?: string;
  /** 创建时间（ISO），用于重名时追加创建日期。 */
  createdAt?: string;
}

/** 保存服务器时的输入。 */
export interface ServerConfigInput {
  /** 传入时按 id 更新已有服务器。 */
  id?: string;
  name?: string;
  serverUrl: string;
  token: string;
  connected?: boolean;
  checkedAt?: string;
  createdAt?: string;
}

const STORAGE_KEY = "loong.web.server-config";

interface StoredState {
  servers: ServerConfig[];
}

function createId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `server-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeConfig(value: Partial<ServerConfig> | null | undefined): ServerConfig | null {
  if (!value || typeof value !== "object") return null;
  if (typeof value.serverUrl !== "string" || !value.serverUrl.trim()) return null;
  if (typeof value.token !== "string") return null;

  return {
    id: typeof value.id === "string" && value.id ? value.id : createId(),
    name: typeof value.name === "string" ? value.name : undefined,
    serverUrl: value.serverUrl.trim(),
    token: value.token,
    connected: typeof value.connected === "boolean" ? value.connected : undefined,
    checkedAt: typeof value.checkedAt === "string" ? value.checkedAt : undefined,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 生成名称后缀：YYYY-MM-dd_HH:mm。 */
function formatNameSuffix(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 名称重复时追加创建日期；仍重复则追加序号。 */
function uniqueName(
  name: string | undefined,
  all: ServerConfig[],
  excludeId: string | undefined,
  createdAt: string,
): string | undefined {
  if (!name || !name.trim()) return undefined;
  const trimmed = name.trim();
  const exists = (candidate: string) =>
    all.some((server) => server.id !== excludeId && server.name?.trim() === candidate);

  if (!exists(trimmed)) return trimmed;

  const base = `${trimmed}_${formatNameSuffix(createdAt)}`;
  if (!exists(base)) return base;

  let index = 2;
  while (exists(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function readStoredServers(): ServerConfig[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as
      | Partial<StoredState>
      | Partial<ServerConfig>
      | Array<Partial<ServerConfig>>
      | null;

    // 旧版本：单个服务器对象。
    if (parsed && !Array.isArray(parsed) && !("servers" in parsed)) {
      const single = normalizeConfig(parsed as Partial<ServerConfig>);
      return single ? [single] : [];
    }

    const rawServers = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as Partial<StoredState> | null)?.servers)
        ? (parsed as Partial<StoredState>).servers!
        : [];
    return rawServers
      .map((value) => normalizeConfig(value))
      .filter((value): value is ServerConfig => value !== null);
  } catch {
    return [];
  }
}

const initialServers = readStoredServers();

const [servers, setServers] = createSignal<ServerConfig[]>(initialServers);
// activeId 只保存在内存中，不写入 localStorage；刷新后默认选中第一个服务器。
const [activeId, setActiveId] = createSignal<string | null>(initialServers[0]?.id ?? null);

function persist(nextServers: ServerConfig[]): void {
  try {
    const state: StoredState = { servers: nextServers };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时仅当前页面生效。
  }
}

/** 已保存的服务器列表。 */
export { servers };

/** 当前选中的服务器 id。 */
export { activeId as activeServerId };

/** 当前服务器配置；null 表示没有可用配置。 */
export function serverConfig(): ServerConfig | null {
  const list = servers();
  if (list.length === 0) return null;
  return list.find((server) => server.id === activeId()) ?? list[0];
}

/** 切换当前服务器。 */
export function setActiveServer(id: string): void {
  if (!servers().some((server) => server.id === id)) return;
  setActiveId(id);
}

/**
 * 保存服务器：优先按 `id` 更新；未提供 id 时按 `serverUrl` 去重。
 * 名称重复时追加创建日期 `YYYY-MM-dd_HH:mm`，仍重复则继续追加序号。
 * 保存后自动设为当前服务器。
 */
export function saveServerConfig(value: ServerConfigInput): ServerConfig {
  const serverUrl = value.serverUrl.trim();
  const existing = value.id ? servers().find((server) => server.id === value.id) : undefined;
  const createdAt = existing?.createdAt ?? value.createdAt ?? new Date().toISOString();
  const name = uniqueName(
    value.name ?? existing?.name,
    servers(),
    existing?.id,
    createdAt,
  );
  const config: ServerConfig = existing
    ? {
        ...existing,
        name,
        token: value.token,
        serverUrl,
        connected: value.connected ?? existing.connected,
        checkedAt: value.checkedAt ?? existing.checkedAt,
        createdAt,
      }
    : {
        id: value.id ?? createId(),
        name,
        serverUrl,
        token: value.token,
        connected: value.connected,
        checkedAt: value.checkedAt,
        createdAt,
      };

  const next = existing
    ? servers().map((server) => (server.id === existing.id ? config : server))
    : [...servers(), config];
  setServers(next);
  setActiveId(config.id);
  persist(next);
  return config;
}

/** 更新服务器连通状态与检查时间。 */
export function updateServerStatus(id: string, connected: boolean): void {
  const next = servers().map((server) =>
    server.id === id
      ? { ...server, connected, checkedAt: new Date().toISOString() }
      : server,
  );
  if (next.every((server, index) => server === servers()[index])) return;
  setServers(next);
  persist(next);
}

/** 删除服务器；删除当前服务器时自动选中下一个。 */
export function removeServer(id: string): void {
  const next = servers().filter((server) => server.id !== id);
  const nextActiveId = next.some((server) => server.id === activeId())
    ? activeId()
    : next[0]?.id ?? null;
  setServers(next);
  setActiveId(nextActiveId);
  persist(next);
}

/** 清除所有服务器配置。 */
export function clearServerConfig(): void {
  setServers([]);
  setActiveId(null);
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略存储异常。
  }
}

/** 是否至少配置了一个服务器（决定先进入配置页还是登录页）。 */
export function isServerConfigured(): boolean {
  return servers().length > 0;
}
