import { Effect } from "effect";

import { parsePageEnvelope, requestJson, withPrefix, type HttpClientOptions } from "../http";
import type {
  RawWorkspacePagePayload,
  RawWorkspacePayload,
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceListParams,
  WorkspacePage,
  WorkspaceUpdateRequest,
} from "../types";
import { ClientError } from "../types/errors";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parsePath(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // 兼容历史普通路径字符串。
  }
  return [value];
}

function encodePath(path: string[]): string {
  return JSON.stringify(path);
}

function toWorkspace(payload: RawWorkspacePayload): Workspace {
  return {
    id: typeof payload.id === "string" ? payload.id : String(payload.id ?? ""),
    tenantId: typeof payload.tenant_id === "string" ? payload.tenant_id : String(payload.tenant_id ?? ""),
    userId: typeof payload.user_id === "string" ? payload.user_id : String(payload.user_id ?? ""),
    name: asNullableText(payload.name),
    path: parsePath(payload.path),
    createdAt: asNullableText(payload.created_at),
    updatedAt: asNullableText(payload.updated_at),
  };
}

/** 工作目录接口：分页列表、创建、详情、更新与删除。 */
export class WorkspaceApi {
  constructor(private readonly options: HttpClientOptions) {}

  list(params: WorkspaceListParams = {}): Effect.Effect<WorkspacePage, ClientError> {
    const prefix = withPrefix(this.options.prefix, "/api/cloud/common");
    const query = new URLSearchParams({
      page: String(params.page ?? 1),
      page_size: String(params.pageSize ?? 20),
    });
    return requestJson<{
      total: number | null;
      page: number | null;
      pageSize: number | null;
      rows: RawWorkspacePayload[];
    }>(this.options, `/api/workspace?${query.toString()}`, {
      prefix,
      parse: (response) => parsePageEnvelope<RawWorkspacePayload>(
        response,
        this.options.locale,
      ),
    }).pipe(Effect.map((page) => ({
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      rows: page.rows.map((item) => toWorkspace(asRecord(item) ?? {})),
    })));
  }

  create(request: WorkspaceCreateRequest): Effect.Effect<Workspace, ClientError> {
    return requestJson<RawWorkspacePayload>(this.options, "/api/workspace", {
      method: "POST",
      prefix: withPrefix(this.options.prefix, "/api/cloud/common"),
      body: { name: request.name, path: encodePath(request.path) },
    }).pipe(Effect.map((payload) => toWorkspace(payload)));
  }

  get(id: number | string): Effect.Effect<Workspace, ClientError> {
    return requestJson<RawWorkspacePayload>(
      this.options,
      `/api/workspace/${encodeURIComponent(String(id))}`,
      { prefix: withPrefix(this.options.prefix, "/api/cloud/common") },
    ).pipe(Effect.map((payload) => toWorkspace(payload)));
  }

  update(id: number | string, request: WorkspaceUpdateRequest): Effect.Effect<Workspace, ClientError> {
    return requestJson<RawWorkspacePayload>(
      this.options,
      `/api/workspace/${encodeURIComponent(String(id))}`,
      {
        method: "PUT",
        prefix: withPrefix(this.options.prefix, "/api/cloud/common"),
        body: { name: request.name, path: encodePath(request.path) },
      },
    ).pipe(Effect.map((payload) => toWorkspace(payload)));
  }

  delete(id: number | string): Effect.Effect<void, ClientError> {
    return requestJson<unknown>(
      this.options,
      `/api/workspace/${encodeURIComponent(String(id))}`,
      {
        method: "DELETE",
        prefix: withPrefix(this.options.prefix, "/api/cloud/common"),
      },
    ).pipe(Effect.map(() => undefined));
  }
}
