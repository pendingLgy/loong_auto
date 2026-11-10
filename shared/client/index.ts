import { Effect } from "effect";
import { createParser } from "eventsource-parser";
import type { CreateTask, Task, TaskDetail, TaskEvent } from "../contracts/types";

export class ClientError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

/** 仅连接本地网关；不接受云端凭证或任意远程 URL。 */
export function createLocalClient(options: {
  origin: string; token?: string;
  decodeEvent: (input: unknown) => TaskEvent;
}) {
  const url = new URL(options.origin);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new ClientError("客户端只能连接本地网关");
  }
  const headers = () => ({
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  });
  const request = <T>(path: string, decode: (input: unknown) => T, body?: unknown) =>
    Effect.tryPromise({
      try: async (signal) => {
        const response = await fetch(new URL(path, url), {
          method: body === undefined ? "GET" : "POST", headers: headers(),
          credentials: "same-origin", redirect: "error", signal,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (!response.ok) throw new ClientError("本地网关请求失败", response.status);
        return decode(await response.json());
      },
      catch: (cause) => cause instanceof ClientError ? cause : new ClientError(String(cause)),
    });

  return {
    createTask: (body: CreateTask, decode: (input: unknown) => Task) =>
      request("/local/v1/tasks", decode, body),
    task: (id: string, decode: (input: unknown) => TaskDetail) =>
      request(`/local/v1/tasks/${encodeURIComponent(id)}`, decode),
    cancel: (id: string, decode: (input: unknown) => Task) =>
      request(`/local/v1/tasks/${encodeURIComponent(id)}/cancel`, decode, {}),
    /** 取消 Effect 会关闭连接；调用者保存游标后决定重连策略。 */
    events: (after: number, onEvent: (event: TaskEvent) => void) => Effect.tryPromise({
      try: async (signal) => {
        if (!Number.isSafeInteger(after) || after < 0) throw new ClientError("无效事件游标");
        const response = await fetch(new URL(`/local/v1/events?after=${after}`, url), {
          headers: { ...headers(), Accept: "text/event-stream" },
          credentials: "same-origin", redirect: "error", signal,
        });
        if (!response.ok || !response.body ||
            !response.headers.get("content-type")?.includes("text/event-stream")) {
          throw new ClientError("无法订阅本地事件", response.status);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = createParser({ onEvent: (event) => {
          onEvent(options.decodeEvent(JSON.parse(event.data)));
        } });
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.feed(decoder.decode(value, { stream: true }));
          }
          parser.feed(decoder.decode());
        } finally {
          await reader.cancel();
          reader.releaseLock();
        }
      },
      catch: (cause) => new ClientError(String(cause)),
    }),
  };
}
