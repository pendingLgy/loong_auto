import {
  createEffect,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
  type Setter,
} from "solid-js";

import type { ChatMessage } from "@loong/ui/chat";
import { MessageStatus, type MessageStatusValue } from "../chat/status";

/** 工具调用信息。 */
export interface StoredToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  location?: string;
}

/** 本地聊天消息。 */
export interface StoredChatMessage extends ChatMessage {
  status?: MessageStatusValue;
  workspaceId?: string;
  sessionId?: string;
  /** 从历史存储/分页加载的消息不参与打字机动画。 */
  history?: boolean;
  /** tool_calling 事件中的待审批工具消息。 */
  tool_call_messages?: unknown[];
  /** 全部工具调用。 */
  tool_calls?: StoredToolCall[];
  /** 需要当前执行节点处理的工具调用。 */
  remote_tool_calls?: StoredToolCall[];
}

export interface StoredToolCallEvent {
  tool_call_messages?: unknown[];
  tool_calls?: StoredToolCall[];
  remote_tool_calls?: StoredToolCall[];
}

const STORAGE_KEY_PREFIX = "loong.web.chat-messages";
const PAGE_KEY_PREFIX = "loong.web.chat-pages";

type MessageStore = {
  get: Accessor<StoredChatMessage[]>;
  set: Setter<StoredChatMessage[]>;
};

const stores = new Map<string, MessageStore>();


function asMessageStatusValue(value: unknown): MessageStatusValue | undefined {
  return typeof value === "string"
    && Object.values(MessageStatus).includes(value as MessageStatusValue)
    ? value as MessageStatusValue
    : undefined;
}

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
    status: asMessageStatusValue(item.status),
    workspaceId: typeof item.workspaceId === "string" ? item.workspaceId : undefined,
    sessionId: typeof item.sessionId === "string" ? item.sessionId : undefined,
    // 从 localStorage 读出的消息一律视为历史消息。
    history: true,
    tool_call_messages: Array.isArray(item.tool_call_messages)
      ? item.tool_call_messages
      : [],
    tool_calls: Array.isArray(item.tool_calls)
      ? item.tool_calls.filter((call): call is StoredToolCall =>
        typeof call === "object" && call !== null
        && typeof (call as StoredToolCall).id === "string"
        && typeof (call as StoredToolCall).name === "string"
        && typeof (call as StoredToolCall).arguments === "object")
      : [],
    remote_tool_calls: Array.isArray(item.remote_tool_calls)
      ? item.remote_tool_calls.filter((call): call is StoredToolCall =>
        typeof call === "object" && call !== null
        && typeof (call as StoredToolCall).id === "string"
        && typeof (call as StoredToolCall).name === "string"
        && typeof (call as StoredToolCall).arguments === "object")
      : [],
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
  status?: MessageStatusValue,
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
          content: content || item.content,
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
        history: false,
        createdAt: new Date().toISOString(),
      }];
    persistMessages(sessionId, next);
    return next;
  });
}

/** 追加工具执行结果到对应 assistant 消息。 */
export function appendToolCallMessage(
  sessionId: string,
  messageId: string,
  result: unknown,
): void {
  if (!sessionId || !messageId) return;
  const store = getStore(sessionId);
  const toolId = typeof result === "object" && result !== null
    ? (result as Record<string, unknown>).tool_call_id
    : undefined;

  store.set((current) => {
    const next = current.map((item) => {
      if (item.id !== messageId) return item;
      const results = item.tool_call_messages ?? [];
      if (typeof toolId === "string" && results.some((entry) => {
        if (typeof entry !== "object" || entry === null) return false;
        return (entry as Record<string, unknown>).tool_call_id === toolId;
      })) {
        return item;
      }
      return {...item, tool_call_messages: [...results, result]};
    });
    persistMessages(sessionId, next);
    return next;
  });
}

/** 保存 tool_calling 的工具调用字段，保留已有正文。 */
export function setAssistantToolCalls(
  sessionId: string,
  id: string,
  content: string,
  calls: StoredToolCallEvent,
  status?: MessageStatusValue,
  workspaceId?: string,
): void {
  if (!sessionId) return;
  const store = getStore(sessionId);
  store.set((current) => {
    const patch = {
      tool_call_messages: calls.tool_call_messages ?? [],
      tool_calls: calls.tool_calls ?? [],
      remote_tool_calls: calls.remote_tool_calls ?? [],
      status,
      workspaceId,
      sessionId,
    };
    const existing = current.find((item) => item.id === id);
    const next = existing
      ? current.map((item) => item.id === id
        ? {
          ...item,
          ...patch,
          content: content || item.content,
          status: status ?? item.status,
          workspaceId: workspaceId ?? item.workspaceId,
        }
        : item)
      : [...current, {
        id,
        role: "assistant" as const,
        content,
        createdAt: new Date().toISOString(),
        history: false,
        ...patch,
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
  status?: MessageStatusValue,
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
        history: false,
        createdAt: new Date().toISOString(),
      }];
    persistMessages(sessionId, next);
    return next;
  });
}

/** 收到 stop 后，将当前会话的助手消息标记为历史记录。 */
export function markChatSessionHistory(sessionId: string): void {
  if (!sessionId) return;
  const store = getStore(sessionId);
  store.set((current) => {
    const next = current.map((message) =>
      message.role === "assistant"
        ? {
          ...message,
          history: true,
          status: message.status === MessageStatus.TOOL_CALLING
            ? MessageStatus.STOP
            : message.status,
        }
        : message);
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
  sessionId: Accessor<string>,
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

  const shouldAnimate = (message: StoredChatMessage) =>
    !message.history
    && message.role === "assistant"
    && (message.status === MessageStatus.RUNNING || message.status === MessageStatus.START);

  const step = () => {
    const target = source();
    setDisplay((current) => {
      let changed = false;
      const next = current.map((message) => {
        if (!shouldAnimate(message)) return message;
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
        if (!shouldAnimate(message)) return { ...message };
        const shown = byId.get(message.id);
        if (!shown || !message.content.startsWith(shown.content)) {
          return { ...message, content: "" };
        }
        return { ...message, content: shown.content };
      });
    });

    const shown = untrack(display);
    const needsTyping = target.some((message) => {
      if (!shouldAnimate(message)) return false;
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
      if (key?.startsWith(`${STORAGE_KEY_PREFIX}:`)
        || key?.startsWith(`${PAGE_KEY_PREFIX}:`)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // 忽略存储异常。
  }
}


/** 已加载的消息分页状态。 */
export interface ChatPagingState {
  page: number;
  hasMore: boolean;
}

/** 读取 session 的已加载分页状态。 */
export function getChatPaging(sessionId: string): ChatPagingState {
  if (!sessionId) return {page: 0, hasMore: false};
  try {
    const raw = window.localStorage.getItem(`${PAGE_KEY_PREFIX}:${sessionId}`);
    if (!raw) return {page: 0, hasMore: false};
    const parsed = JSON.parse(raw) as Partial<ChatPagingState> | null;
    return {
      page: typeof parsed?.page === "number" && parsed.page > 0 ? parsed.page : 0,
      hasMore: parsed?.hasMore === true,
    };
  } catch {
    return {page: 0, hasMore: false};
  }
}

/** 保存 session 的已加载分页状态。 */
export function saveChatPaging(sessionId: string, state: ChatPagingState): void {
  if (!sessionId) return;
  try {
    window.localStorage.setItem(`${PAGE_KEY_PREFIX}:${sessionId}`, JSON.stringify(state));
  } catch {
    // 忽略存储异常。
  }
}

/** 用服务端分页结果替换 session 消息。 */
export function replaceChatMessages(sessionId: string, messages: StoredChatMessage[]): void {
  if (!sessionId) return;
  const history = messages.map((message) => ({...message, history: true}));
  getStore(sessionId).set(history);
  persistMessages(sessionId, history);
}

/** 向消息列表头部追加历史消息，按消息 ID 去重。 */
export function prependChatMessages(sessionId: string, messages: StoredChatMessage[]): void {
  if (!sessionId || messages.length === 0) return;
  const store = getStore(sessionId);
  store.set((current) => {
    const ids = new Set(current.map((message) => message.id));
    const older = messages
      .filter((message) => !ids.has(message.id))
      .map((message) => ({...message, history: true}));
    if (older.length === 0) return current;
    const next = [...older, ...current];
    persistMessages(sessionId, next);
    return next;
  });
}
