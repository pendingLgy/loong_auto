import type {MessageKey} from "../i18n/en-US";

import {HttpRequestError, HttpTimeoutError} from "./errors";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type TranslateParams = Record<string, string | number>;

export interface HttpTranslate {
  (key: MessageKey, fallback?: string, params?: TranslateParams): string;

  (key: MessageKey, params?: TranslateParams): string;
}

function defaultTranslate(
  key: MessageKey,
  fallbackOrParams?: string | TranslateParams,
  params: TranslateParams = {},
): string {
  const fallback = typeof fallbackOrParams === "string" ? fallbackOrParams : undefined;
  const values = typeof fallbackOrParams === "object" ? fallbackOrParams : params;
  const template = fallback ?? key;
  return template.replace(/\{([^}]+)\}/g, (_, name: string) =>
    String(values[name] ?? `{${name}}`));
}

export interface HttpClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  headers?: HeadersInit;
  fetch?: typeof fetch;
  /** 文案翻译函数；不传时使用中文兜底。 */
  translate?: HttpTranslate;
}

export interface HttpRequestOptions {
  method?: HttpMethod;
  headers?: HeadersInit;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

function buildUrl(
  baseUrl: string,
  path: string,
  query?: HttpRequestOptions["query"],
): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function isBodyInit(value: unknown): value is BodyInit {
  return typeof value === "string"
    || value instanceof FormData
    || value instanceof Blob
    || value instanceof URLSearchParams;
}


/** 带超时、JSON 序列化与统一错误处理的 HTTP 客户端。 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly headers: HeadersInit | undefined;
  private readonly translate: HttpTranslate;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.headers = config.headers;
    this.translate = config.translate ?? defaultTranslate;
  }

  async request(path: string, options: HttpRequestOptions = {}): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(
      () => {
        timedOut = true;
        controller.abort(new Error("timeout"));
      },
      options.timeoutMs ?? this.timeoutMs,
    );

    const abort = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) {
      abort();
    } else {
      options.signal?.addEventListener("abort", abort, {once: true});
    }

    const headers = new Headers(this.headers);
    new Headers(options.headers).forEach((value, key) => headers.set(key, value));

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (isBodyInit(options.body)) {
        body = options.body;
      } else {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(options.body);
      }
    }

    try {
      return await fetch(
        buildUrl(this.baseUrl, path, options.query),
        {
          method: options.method ?? "GET",
          headers,
          body,
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (error instanceof HttpRequestError) throw error;
      if (controller.signal.aborted) {
        if (options.signal?.aborted) {
          throw new HttpRequestError(this.translate("http.cancelled", "请求已取消"));
        }
        if (timedOut) {
          throw new HttpTimeoutError(this.translate("http.timeout", "请求超时"));
        }
      }
      throw new HttpRequestError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      window.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }
}

/** 创建 HTTP 客户端。 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}
