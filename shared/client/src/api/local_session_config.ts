import { Effect } from "effect";

import { requestJson, type HttpClientOptions } from "../http";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import type {
  RawSessionConfigPayload,
  SessionConfig,
  SessionConfigSaveRequest,
  SessionConfigUpdateRequest,
  WorkspaceMode,
} from "../types";
import { ClientError } from "../types/errors";

/** 本地网关的会话配置路由不经过云端转发，固定使用根路径前缀。 */
const LOCAL_PREFIX = "/";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asWorkspaceMode(value: unknown): WorkspaceMode {
  return value === "workspace_write" || value === "full" ? value : "read_only";
}

/** 原始会话配置 → 客户端领域模型。 */
export function toSessionConfig(
  payload: unknown,
  locale: Locale = DEFAULT_LOCALE,
): SessionConfig {
  const data = asRecord(payload);
  const sessionId = asText(data?.session_id);
  if (!sessionId) {
    throw new ClientError(
      translate(locale, "client.errors.invalidSessionConfig", "会话配置响应不合法"),
    );
  }

  const workspaces = Array.isArray(data?.workspaces)
    ? data?.workspaces.filter((item): item is string => typeof item === "string")
    : [];

  return {
    sessionId,
    workspaceMode: asWorkspaceMode(data?.workspace_mode),
    workspaces,
    createdAt: typeof data?.created_at === "string" ? data.created_at : null,
    updatedAt: typeof data?.updated_at === "string" ? data.updated_at : null,
  };
}

function configPath(sessionId: string): string {
  return `/api/session-configs/${encodeURIComponent(sessionId)}`;
}

/** 会话配置接口：读取、创建/覆盖、局部更新与删除。 */
export class SessionConfigApi {
  static readonly httpMethods = {get: "GET"} as const;


  constructor(private readonly options: HttpClientOptions) {}

  get(sessionId: string): Effect.Effect<SessionConfig, ClientError> {
    return requestJson<RawSessionConfigPayload>(
      this.options,
      configPath(sessionId),
      { prefix: LOCAL_PREFIX },
    ).pipe(Effect.map((payload) => toSessionConfig(payload, this.options.locale)));
  }

  save(sessionId: string, request: SessionConfigSaveRequest): Effect.Effect<SessionConfig, ClientError> {
    return requestJson<RawSessionConfigPayload>(this.options, configPath(sessionId), {
      method: "PUT",
      prefix: LOCAL_PREFIX,
      body: {
        workspace_mode: request.workspaceMode,
        workspaces: request.workspaces,
      },
    }).pipe(Effect.map((payload) => toSessionConfig(payload, this.options.locale)));
  }

  update(
    sessionId: string,
    request: SessionConfigUpdateRequest,
  ): Effect.Effect<SessionConfig, ClientError> {
    const body: Record<string, unknown> = {};
    if (request.workspaceMode !== undefined) body.workspace_mode = request.workspaceMode;
    if (request.workspaces !== undefined) body.workspaces = request.workspaces;

    return requestJson<RawSessionConfigPayload>(this.options, configPath(sessionId), {
      method: "PATCH",
      prefix: LOCAL_PREFIX,
      body,
    }).pipe(Effect.map((payload) => toSessionConfig(payload, this.options.locale)));
  }

  remove(sessionId: string): Effect.Effect<void, ClientError> {
    return requestJson<boolean>(this.options, configPath(sessionId), {
      method: "DELETE",
      prefix: LOCAL_PREFIX,
    }).pipe(Effect.map(() => undefined));
  }
}
