import {
  createEffect,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
  type Setter,
} from "solid-js";

import type { ChatMessage } from "@loong/ui/chat";

/** 本地聊天消息。 */
export interface StoredChatMessage extends ChatMessage {
  status?: string;
  workspaceId?: string;
  sessionId?: string;
}

const STORAGE_KEY_PREFIX = "loong.web.chat-messages";

type MessageStore = {
  get: Accessor<StoredChatMessage[]>;
  set: Setter<StoredChatMessage[]>;
};

const stores = new Map<string, MessageStore>();

function storageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}:${sessionId}`;
}

function normalizeMessage(value: unknown): StoredChatMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Partial<StoredChatMessage>;
  if (typeof item.id !== "string" || !item.id) return null;
  if (item.role !== "user" && item.role !== "assistant" && item.role !== "system") return null;
  if (typeof item.content !== "string") return null;

  return {
    id: item.id,
    role: item.role,
    content: item.content,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
    status: typeof item.status === "string" ? item.status : undefined,
    workspaceId: typeof item.workspaceId === "string" ? item.workspaceId : undefined,
    sessionId: typeof item.sessionId === "string" ? item.sessionId : undefined,
  };
}

function readMessages(sessionId: string): StoredChatMessage[] {
  if (!sessionId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(normalizeMessage).filter((item): item is StoredChatMessage => item !== null)
      : [];
  } catch {
    return [];
  }
}

function persistMessages(sessionId: string, messages: StoredChatMessage[]): void {
  if (!sessionId) return;
  try {
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(messages));
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}

function getStore(sessionId: string): MessageStore {
  const existing = stores.get(sessionId);
  if (existing) return existing;

  const [get, set] = createSignal<StoredChatMessage[]>(readMessages(sessionId));
  const store: MessageStore = { get, set };
  stores.set(sessionId, store);
  return store;
}

/** 获取指定 session 的本地消息响应式存储。 */
export function chatMessages(sessionId: string): Accessor<StoredChatMessage[]> {
  return getStore(sessionId).get;
}

/** 追加一条本地消息并持久化。 */
export function appendChatMessage(sessionId: string, message: StoredChatMessage): void {
  if (!sessionId) return;
  const store = getStore(sessionId);
  store.set((current) => {
    const next = current.some((item) => item.id === message.id)
      ? current.map((item) => item.id === message.id ? { ...item, ...message } : item)
      : [...current, message];
    persistMessages(sessionId, next);
    return next;
  });
}

/** 更新指定消息内容；不存在时创建助手消息。 */
export function upsertAssistantMessage(
  sessionId: string,
  id: string,
  content: string,
  status?: string,
  workspaceId?: string,
): void {
  if (!sessionId) return;
  const store = getStore(sessionId);
  store.set((current) => {
    const existing = current.find((item) => item.id === id);
    const next = existing
      ? current.map((item) => item.id === id
        ? {
          ...item,
          content,
          status: status ?? item.status,
          workspaceId: workspaceId ?? item.workspaceId,
          sessionId,
        }
        : item)
      : [...current, {
        id,
        role: "assistant" as const,
        content,
        status,
        workspaceId,
        sessionId,
        createdAt: new Date().toISOString(),
      }];
    persistMessages(sessionId, next);
    return next;
  });
}

/** 追加助手消息的流式增量。 */
export function appendAssistantMessageDelta(
  sessionId: string,
  id: string,
  delta: string,
  status?: string,
  workspaceId?: string,
): void {
  if (!sessionId || !delta) return;
  const store = getStore(sessionId);
  store.set((current) => {
    const existing = current.find((item) => item.id === id);
    const next = existing
      ? current.map((item) => item.id === id
        ? {
          ...item,
          content: item.content + delta,
          status: status ?? item.status,
          workspaceId: workspaceId ?? item.workspaceId,
          sessionId,
        }
        : item)
      : [...current, {
        id,
        role: "assistant" as const,
        content: delta,
        status,
        workspaceId,
        sessionId,
        createdAt: new Date().toISOString(),
      }];
    persistMessages(sessionId, next);
    return next;
  });
}

/** 清空指定 session 的本地消息。 */
export function clearChatMessages(sessionId: string): void {
  if (!sessionId) return;
  getStore(sessionId).set([]);
  persistMessages(sessionId, []);
}

/** 监听本地消息并生成打字机效果。 */
export function useTypewriterMessages(
  source: Accessor<StoredChatMessage[]>,
  intervalMs = 16,
): Accessor<StoredChatMessage[]> {
  const [display, setDisplay] = createSignal<StoredChatMessage[]>(source());
  let timer: number | undefined;

  const stopTimer = () => {
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  const step = () => {
    const target = source();
    setDisplay((current) => {
      let changed = false;
      const next = current.map((message) => {
        if (message.role !== "assistant") return message;
        const latest = target.find((item) => item.id === message.id);
        if (!latest || message.content.length >= latest.content.length) return message;
        changed = true;
        return {
          ...message,
          content: latest.content.slice(0, message.content.length + 1),
        };
      });
      if (!changed) stopTimer();
      return next;
    });
  };

  createEffect(() => {
    const target = source();
    setDisplay((current) => {
      const byId = new Map(current.map((message) => [message.id, message]));
      return target.map((message) => {
        if (message.role !== "assistant") return { ...message };
        const shown = byId.get(message.id);
        if (!shown || !message.content.startsWith(shown.content)) {
          return { ...message, content: "" };
        }
        return { ...message, content: shown.content };
      });
    });

    const shown = untrack(display);
    const needsTyping = target.some((message) => {
      if (message.role !== "assistant") return false;
      const current = shown.find((item) => item.id === message.id);
      return !current || current.content.length < message.content.length;
    });
    if (needsTyping && timer === undefined) {
      timer = window.setInterval(step, intervalMs);
    } else if (!needsTyping) {
      stopTimer();
    }
  });

  onCleanup(stopTimer);
  return display;
}


/** 清除全部本地聊天消息。 */
export function clearAllChatMessages(): void {
  stores.clear();
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(`${STORAGE_KEY_PREFIX}:`)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // 忽略存储异常。
  }
}
