import type { ApiEnvelope } from "../types";
import { ClientError, UnauthorizedError } from "../types/errors";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

async function tryReadEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  return await response.json().catch(() => null) as ApiEnvelope<T> | null;
}

function messageOf(envelope: ApiEnvelope<unknown> | null): string | undefined {
  if (!envelope) return undefined;
  if (typeof envelope.msg === "string" && envelope.msg.trim()) return envelope.msg;
  // 网关的 HTTPException 使用 FastAPI 的 detail 字段，没有统一信封。
  const detail = (envelope as { detail?: unknown }).detail;
  return typeof detail === "string" && detail.trim() ? detail : undefined;
}

/** 读取云端统一响应信封；非 JSON 响应直接报错。 */
export async function readEnvelope<T>(
  response: Response,
  locale: Locale = DEFAULT_LOCALE,
): Promise<ApiEnvelope<T>> {
  const envelope = await tryReadEnvelope<T>(response);
  if (!envelope || typeof envelope !== "object") {
    throw new ClientError(
      translate(locale, "client.errors.invalidJson", "响应不是合法 JSON"),
      response.status,
    );
  }
  return envelope;
}

/**
 * 解析响应信封：
 * - 401（HTTP 状态或信封 code）抛 `UnauthorizedError`，即使响应体不是 JSON；
 * - 其它非 2xx 或 `code !== 200` 抛 `ClientError`；
 * - 成功返回 `data`。
 */
export async function parseEnvelope<T>(
  response: Response,
  locale: Locale = DEFAULT_LOCALE,
): Promise<T> {
  const envelope = await tryReadEnvelope<T>(response);
  const message = messageOf(envelope);

  if (response.status === 401) {
    throw new UnauthorizedError(
      message ?? translate(locale, "client.errors.unauthorized", "未登录或登录已过期"),
    );
  }

  if (!envelope || typeof envelope !== "object") {
    throw new ClientError(
      translate(locale, "client.errors.invalidJson", "响应不是合法 JSON"),
      response.status,
    );
  }

  const code = typeof envelope.code === "number" ? envelope.code : undefined;
  if (code === 401) {
    throw new UnauthorizedError(
      message ?? translate(locale, "client.errors.unauthorized", "未登录或登录已过期"),
    );
  }

  if (!response.ok || envelope.code !== 200) {
    throw new ClientError(
      message ?? translate(locale, "client.errors.requestFailed", "请求失败"),
      response.status,
      code,
    );
  }

  return envelope.data as T;
}


/** 云端分页响应（顶层字段，不在统一信封的 data 内）。 */
export interface PageResult<T> {
  total: number | null;
  page: number | null;
  pageSize: number | null;
  rows: T[];
}

interface PageEnvelope<T> {
  code?: number;
  msg?: string;
  total?: number | null;
  page?: number | null;
  page_size?: number | null;
  rows?: T[] | null;
}

/** 解析云端分页响应并保留分页元数据。 */
export async function parsePageEnvelope<T>(
  response: Response,
  locale: Locale = DEFAULT_LOCALE,
): Promise<PageResult<T>> {
  const envelope = await response.json().catch(() => null) as PageEnvelope<T> | null;
  const message = messageOf(envelope as ApiEnvelope<unknown> | null);

  if (response.status === 401 || envelope?.code === 401) {
    throw new UnauthorizedError(
      message ?? translate(locale, "client.errors.unauthorized", "未登录或登录已过期"),
    );
  }

  if (!envelope || typeof envelope !== "object") {
    throw new ClientError(
      translate(locale, "client.errors.invalidJson", "响应不是合法 JSON"),
      response.status,
    );
  }

  if (!response.ok || envelope.code !== 200) {
    throw new ClientError(
      message ?? translate(locale, "client.errors.requestFailed", "请求失败"),
      response.status,
      typeof envelope.code === "number" ? envelope.code : undefined,
    );
  }

  return {
    total: typeof envelope.total === "number" ? envelope.total : null,
    page: typeof envelope.page === "number" ? envelope.page : null,
    pageSize: typeof envelope.page_size === "number" ? envelope.page_size : null,
    rows: Array.isArray(envelope.rows) ? envelope.rows : [],
  };
}
