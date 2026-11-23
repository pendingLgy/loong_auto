import { Effect } from "effect";

import { parsePageEnvelope, requestJson, withPrefix, type HttpClientOptions } from "../http";
import type {
  MessageListParams,
  MessagePage,
  MessageRecord,
  RawMessagePayload,
} from "../types";
import { ClientError } from "../types/errors";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asId(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function toMessage(payload: RawMessagePayload): MessageRecord {
  return {
    id: asId(payload.id),
    tenantId: asId(payload.tenant_id),
    userId: asId(payload.user_id),
    sessionId: typeof payload.session_id === "string" ? payload.session_id : "",
    model: asNullableText(payload.model),
    messageId: asNullableText(payload.message_id),
    created: payload.created == null ? null : asId(payload.created),
    role: asNullableText(payload.role),
    content: asNullableText(payload.content),
    toolCalls: Array.isArray(payload.tool_calls)
      ? payload.tool_calls
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
      : [],
    toolCallId: asNullableText(payload.tool_call_id),
  };
}

/** 消息接口：按 session 分页查询。 */
export class MessageApi {
  static readonly httpMethods = {list: "GET"} as const;


  constructor(private readonly options: HttpClientOptions) {}

  list(
    sessionId: string,
    params: MessageListParams = {},
  ): Effect.Effect<MessagePage, ClientError> {
    const query = new URLSearchParams({
      session_id: sessionId,
      page: String(params.page ?? 1),
      page_size: String(params.pageSize ?? 20),
    });
    return requestJson<{
      total: number | null;
      page: number | null;
      pageSize: number | null;
      rows: RawMessagePayload[];
    }>(this.options, `/api/messages?${query.toString()}`, {
      prefix: withPrefix(this.options.prefix, "/api/cloud/common"),
      parse: (response) => parsePageEnvelope<RawMessagePayload>(
        response,
        this.options.locale,
      ),
    }).pipe(Effect.map((page) => ({
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      rows: page.rows.map((item) => toMessage(asRecord(item) ?? {})),
    })));
  }
}
