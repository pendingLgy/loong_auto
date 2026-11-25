import type { MessageKey } from "../i18n/en-US";

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

/** HTTP 请求错误。 */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
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

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

/** 带超时、JSON 序列化与统一错误处理的 HTTP 客户端。 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly headers: HeadersInit | undefined;
  private readonly fetcher: typeof fetch;
  private readonly translate: HttpTranslate;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.headers = config.headers;
    this.fetcher = config.fetch ?? fetch;
    this.translate = config.translate ?? defaultTranslate;
  }

  async request<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(new Error("timeout")),
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
      const response = await this.fetcher(
        buildUrl(this.baseUrl, path, options.query),
        {
          method: options.method ?? "GET",
          headers,
          body,
          signal: controller.signal,
        },
      );
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new HttpError(
          this.translate("http.error", "请求失败：{status} {statusText}", {
            status: response.status,
            statusText: response.statusText,
          }),
          response.status,
          data,
        );
      }
      return data as T;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (controller.signal.aborted) {
        throw new HttpError(
          options.signal?.aborted
            ? this.translate("http.cancelled", "请求已取消")
            : this.translate("http.timeout", "请求超时"),
          options.signal?.aborted ? undefined : 408,
        );
      }
      throw new HttpError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      window.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  get<T>(path: string, options: Omit<HttpRequestOptions, "method" | "body"> = {}) {
    return this.request<T>(path, {...options, method: "GET"});
  }

  post<T>(path: string, body?: unknown, options: Omit<HttpRequestOptions, "method" | "body"> = {}) {
    return this.request<T>(path, {...options, method: "POST", body});
  }

  put<T>(path: string, body?: unknown, options: Omit<HttpRequestOptions, "method" | "body"> = {}) {
    return this.request<T>(path, {...options, method: "PUT", body});
  }

  patch<T>(path: string, body?: unknown, options: Omit<HttpRequestOptions, "method" | "body"> = {}) {
    return this.request<T>(path, {...options, method: "PATCH", body});
  }

  delete<T>(path: string, options: Omit<HttpRequestOptions, "method" | "body"> = {}) {
    return this.request<T>(path, {...options, method: "DELETE"});
  }
}

/** 创建 HTTP 客户端。 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}
