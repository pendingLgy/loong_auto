import { notifySessionConfig } from "../events";

/** 每个会话使用的模型与工作区配置。 */

export interface SessionConfig {
  /** 会话所属工作区。 */
  workspaceId?: string;
  /** 会话使用的模型。 */
  model?: string;
  /** 模型供应商。 */
  provider?: string;
  /** 会话尚未在云端创建。 */
  pending?: boolean;
}

const STORAGE_KEY_PREFIX = "loong.web.session-config";

function storageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}:${sessionId}`;
}

/** 读取会话配置。 */
export function getSessionConfig(sessionId: string): SessionConfig {
  if (!sessionId) return {};
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<SessionConfig> | null;
    return {
      workspaceId: typeof parsed?.workspaceId === "string" ? parsed.workspaceId : undefined,
      model: typeof parsed?.model === "string" ? parsed.model : undefined,
      provider: typeof parsed?.provider === "string" ? parsed.provider : undefined,
      pending: parsed?.pending === true,
    };
  } catch {
    return {};
  }
}

/** 保存会话配置；仅更新传入的字段。 */
export function saveSessionConfig(sessionId: string, patch: SessionConfig): void {
  if (!sessionId) return;
  const current = getSessionConfig(sessionId);
  const next: SessionConfig = {...current, ...patch};
  const changed = current.workspaceId !== next.workspaceId
    || current.model !== next.model
    || current.provider !== next.provider;

  try {
    if (!next.workspaceId && !next.model && !next.provider && !next.pending) {
      window.localStorage.removeItem(storageKey(sessionId));
      return;
    }
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(next));
    if (changed) {
      notifySessionConfig({sessionId});
    }
  } catch {
    // 忽略存储异常。
  }
}

/** 清空会话配置。 */
export function clearSessionConfig(sessionId: string): void {
  if (!sessionId) return;
  try {
    window.localStorage.removeItem(storageKey(sessionId));
  } catch {
    // 忽略存储异常。
  }
}
