import { Effect } from "effect";

import { parsePageEnvelope, requestJson, withPrefix, type HttpClientOptions } from "../http";
import type {
  RawSessionPagePayload,
  RawSessionPayload,
  Session,
  SessionCreateRequest,
  SessionListParams,
  SessionPage,
  SessionUpdateRequest,
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

function toSession(payload: RawSessionPayload): Session {
  return {
    id: asId(payload.id),
    tenantId: asId(payload.tenant_id),
    userId: asId(payload.user_id),
    sessionId: typeof payload.session_id === "string" ? payload.session_id : "",
    sessionTitle: asNullableText(payload.session_title),
    workspaceId: payload.workspace_id == null ? null : asId(payload.workspace_id),
    model: asNullableText(payload.model),
    messageId: asNullableText(payload.message_id),
    createdAt: asNullableText(payload.created_at),
  };
}

function proxyPrefix(options: HttpClientOptions): string {
  return withPrefix(options.prefix, "/api/cloud/common");
}

function sessionPath(sessionId: string): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}`;
}

/** 会话接口：分页列表、创建、详情与更新。 */
export class SessionApi {
  static readonly httpMethods = {list: "GET", get: "GET"} as const;


  constructor(private readonly options: HttpClientOptions) {}

  list(params: SessionListParams): Effect.Effect<SessionPage, ClientError> {
    const query = new URLSearchParams({
      workspace_id: String(params.workspaceId),
      page: String(params.page ?? 1),
      page_size: String(params.pageSize ?? 20),
    });
    return requestJson<{
      total: number | null;
      page: number | null;
      pageSize: number | null;
      rows: RawSessionPayload[];
    }>(this.options, `/api/sessions?${query.toString()}`, {
      prefix: proxyPrefix(this.options),
      parse: (response) => parsePageEnvelope<RawSessionPayload>(
        response,
        this.options.locale,
      ),
    }).pipe(Effect.map((page) => ({
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      rows: page.rows.map((item) => toSession(asRecord(item) ?? {})),
    })));
  }

  create(request: SessionCreateRequest): Effect.Effect<Session, ClientError> {
    return requestJson<RawSessionPayload>(this.options, "/api/sessions", {
      method: "POST",
      prefix: proxyPrefix(this.options),
      body: {
        session_id: request.sessionId,
        session_title: request.sessionTitle,
        workspace_id: String(request.workspaceId),
      },
    }).pipe(Effect.map((payload) => toSession(payload)));
  }

  get(sessionId: string, workspaceId: string | number): Effect.Effect<Session, ClientError> {
    const query = new URLSearchParams({ workspace_id: String(workspaceId) });
    return requestJson<RawSessionPayload>(
      this.options,
      `${sessionPath(sessionId)}?${query.toString()}`,
      { prefix: proxyPrefix(this.options) },
    ).pipe(Effect.map((payload) => toSession(payload)));
  }

  update(
    sessionId: string,
    request: SessionUpdateRequest,
  ): Effect.Effect<Session, ClientError> {
    const body: Record<string, unknown> = {
      workspace_id: String(request.workspaceId),
    };
    if (request.sessionTitle !== undefined) body.session_title = request.sessionTitle;

    return requestJson<RawSessionPayload>(this.options, sessionPath(sessionId), {
      method: "PUT",
      prefix: proxyPrefix(this.options),
      body,
    }).pipe(Effect.map((payload) => toSession(payload)));
  }
}
