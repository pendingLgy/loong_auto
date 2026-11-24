import { createSignal } from "solid-js";

import { Effect } from "effect";
import { createParser, type EventSourceMessage } from "eventsource-parser";

import { ClientError } from "@loong/client";

import { createApiClient } from "../api";
import { showNotice } from "../storage/app_notice";
import {
  appendAssistantMessageDelta,
  chatMessages,
  markChatSessionHistory,
  appendChatMessage,
  setAssistantToolCalls,
  upsertAssistantMessage,
  type StoredChatMessage,
  type StoredToolCall,
} from "../storage/chat_messages";
import { isLoggedIn } from "../storage/user";
import { MessageStatus, asMessageStatus } from "./status";

/** 发送一条聊天消息所需的会话与模型上下文。 */
export interface ChatSendRequest {
  sessionId: string;
  /** WorkspaceView 已提前创建云端会话时设为 true，执行器不再创建。 */
  sessionReady?: boolean;
  workspaceId: string;
  tenantId: string;
  userId: string;
  sessionTitle: string;
  provider: string;
  model: string;
  content: string;
}

interface PendingMessage extends ChatSendRequest {
  /** 本地用户消息 ID，同时作为云端消息 ID。 */
  id: string;
}

interface LoopMessage {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  status?: unknown;
  tool_calls?: unknown;
}

interface LoopEventPayload {
  session_id?: unknown;
  messages?: unknown;
  tool_call_messages?: unknown;
  tool_calls?: unknown;
  remote_tool_calls?: unknown;
  last_message_event?: unknown;
  error?: unknown;
}

interface Connection {
  controller: AbortController;
  connected: boolean;
  closed: boolean;
  idleTimer?: number;
}

const LOOP_EVENT_ALL_MESSAGES = "all_messages";
const LOOP_EVENT_CONNECTED = "connected";
const LOOP_EVENT_HEARTBEAT = "heartbeat";

const QUEUE_STORAGE_KEY = "loong.web.chat-queue";
const CONNECTION_RETRY_MS = 1000;
const IDLE_CLOSE_MS = 10_000;

/** 待发送消息，按本地消息 ID 保存。 */
const queues = new Map<string, PendingMessage>();
const busySessions = new Set<string>();
const createdSessions = new Set<string>();
const sessionWorkspaceIds = new Map<string, string>();
let connection: Connection | undefined;
let queuesLoaded = false;
const [revision, setRevision] = createSignal(0);

function touch(): void {
  setRevision((current) => current + 1);
}

function isPendingMessage(value: unknown): value is PendingMessage {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<PendingMessage>;
  return typeof item.id === "string"
    && typeof item.sessionId === "string"
    && typeof item.workspaceId === "string"
    && typeof item.tenantId === "string"
    && typeof item.userId === "string"
    && typeof item.sessionTitle === "string"
    && typeof item.provider === "string"
    && typeof item.model === "string"
    && typeof item.content === "string"
    && (item.sessionReady === undefined || typeof item.sessionReady === "boolean");
}

function loadQueues(): void {
  if (queuesLoaded) return;
  queuesLoaded = true;
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    const values = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null
        ? Object.values(parsed)
        : [];
    for (const value of values.filter(isPendingMessage)) {
      queues.set(value.id, value);
      sessionWorkspaceIds.set(value.sessionId, value.workspaceId);
    }
  } catch {
    // 损坏队列直接忽略。
  }
}

function persistQueues(): void {
  try {
    if (queues.size === 0) {
      window.localStorage.removeItem(QUEUE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      QUEUE_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(queues)),
    );
  } catch {
    // 存储不可用时仅保留内存队列。
  }
}

function hasWork(): boolean {
  return queues.size > 0 || busySessions.size > 0;
}

function cancelIdleTimer(current: Connection): void {
  if (current.idleTimer !== undefined) {
    window.clearTimeout(current.idleTimer);
    current.idleTimer = undefined;
  }
}

function scheduleIdleClose(current: Connection): void {
  if (hasWork()) {
    cancelIdleTimer(current);
    return;
  }
  if (current.idleTimer !== undefined) return;
  current.idleTimer = window.setTimeout(() => {
    current.idleTimer = undefined;
    if (!hasWork()) {
      current.controller.abort();
    }
  }, IDLE_CLOSE_MS);
}

function toStoredToolCalls(value: unknown): StoredToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const call = item as Record<string, unknown>;
    if (typeof call.id !== "string" || typeof call.name !== "string") return [];
    return [{
      id: call.id,
      name: call.name,
      arguments: typeof call.arguments === "object" && call.arguments !== null
        ? call.arguments as Record<string, unknown>
        : {},
      location: typeof call.location === "string" ? call.location : undefined,
    }];
  });
}

function latestActiveAssistantId(sessionId: string): string | undefined {
  const messages = chatMessages(sessionId)();
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant" && !message.history) return message.id;
  }
  return undefined;
}

function applyLoopEvent(payload: LoopEventPayload, eventType: string): void {
  if (typeof payload.session_id !== "string" || !payload.session_id) return;
  if (!Array.isArray(payload.messages)) return;

  // 不依赖 summary/all_messages 的全量消息，避免重复传输。
  if (eventType === LOOP_EVENT_ALL_MESSAGES) return;

  const sessionId = payload.session_id;
  const workspaceId = sessionWorkspaceIds.get(sessionId);

  payload.messages.forEach((value, index) => {
    if (typeof value !== "object" || value === null) return;
    const message = value as LoopMessage;
    if (message.role !== "assistant") return;
    if (typeof message.content !== "string") return;

    const incomingId = typeof message.id === "string" && message.id
      ? message.id
      : `assistant-${sessionId}-${index}`;
    const status = asMessageStatus(message.status);
    const isFinal = status === MessageStatus.STOP
      || status === MessageStatus.TOOL_CALLING;
    const id = isFinal
      ? latestActiveAssistantId(sessionId) ?? incomingId
      : incomingId;
    if (status === MessageStatus.TOOL_CALLING) {
      setAssistantToolCalls(sessionId, id, message.content, {
        tool_call_messages: Array.isArray(payload.tool_call_messages)
          ? payload.tool_call_messages
          : [],
        tool_calls: toStoredToolCalls(payload.tool_calls ?? message.tool_calls),
        remote_tool_calls: toStoredToolCalls(
          payload.remote_tool_calls ?? message.tool_calls,
        ),
      }, status, workspaceId);
      return;
    }

    if (!message.content && !isFinal) return;

    if (status === MessageStatus.RUNNING || status === MessageStatus.START) {
      appendAssistantMessageDelta(sessionId, id, message.content, status, workspaceId);
    } else {
      upsertAssistantMessage(sessionId, id, message.content, status, workspaceId);
    }
  });
}

function handleEvent(event: EventSourceMessage): void {
  const current = connection;
  if (!current) return;

  let payload: LoopEventPayload;
  try {
    payload = JSON.parse(event.data) as LoopEventPayload;
  } catch {
    return;
  }

  const type = event.event ?? (typeof payload.last_message_event === "string"
    ? payload.last_message_event
    : "message");

  if (type === LOOP_EVENT_HEARTBEAT) {
    scheduleIdleClose(current);
    return;
  }

  cancelIdleTimer(current);

  if (type === LOOP_EVENT_CONNECTED) {
    current.connected = true;
    drain();
    return;
  }

  applyLoopEvent(payload, type);

  if ((type === MessageStatus.STOP || type === MessageStatus.TOOL_CALLING)
    && typeof payload.session_id === "string") {
    // tool_calling 与 stop 都表示本轮模型输出结束。
    // tool_calling 保留工具列表为非历史状态，供界面展示。
    if (type === MessageStatus.STOP) {
      markChatSessionHistory(payload.session_id);
    }
    busySessions.delete(payload.session_id);
    touch();
    drain();
  }
}

async function readEventStream(current: Connection, response: Response): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  const parser = createParser({
    onEvent: (event) => handleEvent(event),
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
  } catch (cause) {
    if (!(cause instanceof DOMException && cause.name === "AbortError")) {
      showNotice("error", "事件订阅中断");
    }
  } finally {
    current.closed = true;
    current.connected = false;
    cancelIdleTimer(current);
    if (connection === current) connection = undefined;
    void reader.cancel().catch(() => undefined);
    if (hasWork()) {
      window.setTimeout(() => void ensureConnection(), CONNECTION_RETRY_MS);
    }
  }
}

async function ensureConnection(): Promise<void> {
  loadQueues();
  if (connection && !connection.closed) return;

  const current: Connection = {
    controller: new AbortController(),
    connected: false,
    closed: false,
  };
  connection = current;

  try {
    const response = await Effect.runPromise(
      createApiClient().events.subscribe("default", current.controller.signal),
    );
    void readEventStream(current, response);
  } catch (cause) {
    current.closed = true;
    if (connection === current) connection = undefined;
    if (!(cause instanceof DOMException && cause.name === "AbortError")) {
      showNotice("error", "建立事件订阅失败");
    }
    if (hasWork()) {
      window.setTimeout(() => void ensureConnection(), CONNECTION_RETRY_MS);
    }
  }
}

async function ensureSession(message: PendingMessage): Promise<void> {
  if (message.sessionReady || createdSessions.has(message.sessionId)) return;

  const client = createApiClient();
  try {
    await Effect.runPromise(client.session.create({
      sessionId: message.sessionId,
      sessionTitle: message.sessionTitle,
      workspaceId: message.workspaceId,
    }));
    createdSessions.add(message.sessionId);
    return;
  } catch (cause) {
    // 页面刷新后本地标记丢失，但云端 session 可能已存在。
    if (!(cause instanceof ClientError)) throw cause;
  }

  await Effect.runPromise(client.session.get(message.sessionId, message.workspaceId));
  createdSessions.add(message.sessionId);
}

async function submitPending(message: PendingMessage): Promise<void> {
  try {
    await ensureSession(message);
    await Effect.runPromise(
      createApiClient().events.submit("default", message.sessionId, {
        tenantId: message.tenantId,
        userId: message.userId,
        workspaceId: message.workspaceId,
        sessionId: message.sessionId,
        sessionTitle: message.sessionTitle,
        llm: {
          provider: message.provider,
          model: message.model,
        },
        tools: [],
        messages: [{
          id: message.id,
          role: "user",
          status: MessageStatus.START,
          content: message.content,
        }],
      }),
    );
  } catch(e) {
    busySessions.delete(message.sessionId);
    let msg = (e instanceof ClientError) ? e.message:"消息发送失败"
    showNotice("error", msg);
    touch();
    drain();
  }
}

function drain(): void {
  if (!connection?.connected || busySessions.size > 0) return;

  for (const [messageId, next] of queues) {
    if (busySessions.has(next.sessionId)) continue;

    queues.delete(messageId);
    persistQueues();
    busySessions.add(next.sessionId);
    touch();
    void submitPending(next);
    return;
  }
}

/** 判断指定会话是否仍有待发送或正在执行的消息。 */
export function isChatStreaming(sessionId: string): boolean {
  revision();
  if (busySessions.has(sessionId)) return true;
  for (const pending of queues.values()) {
    if (pending.sessionId === sessionId) return true;
  }
  return false;
}

/** 添加用户消息到本地并进入发送队列。 */
export function enqueueChatMessage(request: ChatSendRequest): void {
  loadQueues();
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const message: StoredChatMessage = {
    id,
    role: "user",
    content: request.content,
    workspaceId: request.workspaceId,
    sessionId: request.sessionId,
    history: false,
    createdAt: new Date().toISOString(),
  };
  appendChatMessage(request.sessionId, message);

  sessionWorkspaceIds.set(request.sessionId, request.workspaceId);
  queues.set(id, { ...request, id });
  persistQueues();
  touch();

  if (connection) cancelIdleTimer(connection);
  void ensureConnection().then(drain);
}

/** 页面打开时恢复待发送队列与 SSE 订阅。 */
export function startChatExecutor(): void {
  if (!isLoggedIn()) return;
  loadQueues();
  // 队列为空时保持离线，收到新消息入队后再建立 SSE。
  if (hasWork()) {
    void ensureConnection();
  }
}


/** 退出登录时关闭当前 SSE 连接，保留未发送队列。 */
export function stopChatExecutor(): void {
  connection?.controller.abort();
  connection = undefined;
}


/** 清除执行器的连接、队列与内存标记。 */
export function clearChatExecutor(): void {
  connection?.controller.abort();
  connection = undefined;
  queues.clear();
  busySessions.clear();
  createdSessions.clear();
  sessionWorkspaceIds.clear();
  queuesLoaded = false;
  try {
    window.localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch {
    // 忽略存储异常。
  }
  touch();
}
