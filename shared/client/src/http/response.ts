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
