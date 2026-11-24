import { Effect } from "effect";

import {ClientError, HttpTimeoutError} from "../types/errors";
import {DEFAULT_LOCALE, Locale, translate} from "../i18n";
import { parseEnvelope } from "./response";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** 默认请求超时时间（毫秒）。 */
export const DEFAULT_TIMEOUT_MS = 5000;

/** fetch 请求的公共配置。 */
export interface HttpClientOptions {
  /** 本地网关基址。 */
  baseUrl: URL;
  /**
   * 路径前缀，用于适配网关的路由转发（如 `/api/common`）。
   * 默认不添加前缀；本地客户端默认使用 `DEFAULT_PREFIX`。
   */
  prefix?: string;
  /** 访问令牌；存在时自动附带 `Authorization: Bearer`。 */
  token?: string;
  /** 便于测试替换 fetch。 */
  fetch?: typeof fetch;
  /** 错误文案语言，默认中文。 */
  locale?: Locale;
  /** local服务 security_token*/
  security_token?: string;
  /** 请求超时时间（毫秒），默认 5000；0 表示不限制。 */
  timeoutMs?: number;
}

/** 规范化前缀：补前导斜杠、去掉尾部斜杠；空值或 `/` 视为无前缀。 */
export function normalizePrefix(prefix: string | undefined): string {
  if (!prefix) return "";
  const trimmed = prefix.trim();
  if (!trimmed || trimmed === "/") return "";
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
}

/** 拼接前缀与路径，例如 withPrefix("/api/common", "/api/auth/login")。 */
export function withPrefix(prefix: string | undefined, path: string): string {
  const base = normalizePrefix(prefix);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export interface HttpRequestInit {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** 单次请求覆盖 `HttpClientOptions.prefix`。 */
  prefix?: string;
  /** 覆盖默认信封解析，用于分页等非统一 data 响应。 */
  parse?: (response: Response) => Promise<unknown>;
  /** 单次请求超时时间（毫秒）。 */
  timeoutMs?: number;
}

/**
 * 发送 JSON 请求并解析云端统一响应。
 *
 * 仅负责 HTTP 层：拼 URL、编码 JSON、附加令牌、把响应交给 `parseEnvelope`；
 * 领域字段映射留在 `api/` 层。
 */
function createRequestSignal(
  effectSignal: AbortSignal,
  requestSignal: AbortSignal | undefined,
  timeoutMs: number,
): {signal: AbortSignal; timedOut: () => boolean; cleanup: () => void} {
  const controller = new AbortController();
  let timedOut = false;

  const abort = () => controller.abort();
  if (effectSignal.aborted || requestSignal?.aborted) {
    abort();
  } else {
    effectSignal.addEventListener("abort", abort, {once: true});
    requestSignal?.addEventListener("abort", abort, {once: true});
  }

  const timer = timeoutMs > 0
    ? setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs)
    : undefined;

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      if (timer !== undefined) clearTimeout(timer);
      effectSignal.removeEventListener("abort", abort);
      requestSignal?.removeEventListener("abort", abort);
    },
  };
}

async function sendRequest(
  client: HttpClientOptions,
  path: string,
  init: HttpRequestInit,
  signal: AbortSignal,
): Promise<Response> {
  const send = client.fetch ?? fetch;
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...init.headers,
  };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (client.token) {
    headers.Authorization = `Bearer ${client.token}`;
  }
  if (client.security_token) {
    headers['X-Security-Token'] = `${client.security_token}`;
  }

  const url = withPrefix(init.prefix ?? client.prefix, path);
  return await send(new URL(url, client.baseUrl), {
    method,
    headers,
    credentials: "same-origin",
    redirect: "error",
    signal: init.signal ?? signal,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export function requestJson<T>(
  client: HttpClientOptions,
  path: string,
  init: HttpRequestInit = {},
): Effect.Effect<T, ClientError> {
  const timeoutMs = init.timeoutMs ?? client.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return Effect.tryPromise({
    try: async (signal) => {
      const request = createRequestSignal(signal, init.signal, timeoutMs);
      try {
        const response = await sendRequest(
          client,
          path,
          {...init, signal: request.signal},
          request.signal,
        );
        if (init.parse) {
          return await init.parse(response) as T;
        }
        return parseEnvelope<T>(response, client.locale);
      } catch (cause) {
        if (request.timedOut()) {
          let locale = (client.locale) ? client.locale : DEFAULT_LOCALE
          let msg = translate(locale, "client.errors.httpRequestTimeout", "请求超时")
          throw new HttpTimeoutError(msg);
        }
        throw cause;
      } finally {
        request.cleanup();
      }
    },
    catch: (cause) => cause instanceof ClientError
      ? cause
      : new ClientError(cause instanceof Error ? cause.message : String(cause)),
  });
}
