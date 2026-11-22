/** 会话（cloud `/api/sessions`）相关类型。 */

export interface Session {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  sessionTitle: string | null;
  workspaceId: string | null;
  model: string | null;
  messageId: string | null;
  createdAt: string | null;
}

export interface SessionCreateRequest {
  sessionId: string;
  sessionTitle: string;
  workspaceId: string | number;
}

export interface SessionUpdateRequest {
  sessionTitle?: string;
  workspaceId: string | number;
}

export interface SessionListParams {
  workspaceId: string | number;
  page?: number;
  pageSize?: number;
}

export interface SessionPage {
  total: number | null;
  page: number | null;
  pageSize: number | null;
  rows: Session[];
}

/** 云端原始会话字段。 */
export interface RawSessionPayload {
  id?: unknown;
  tenant_id?: unknown;
  user_id?: unknown;
  session_id?: unknown;
  session_title?: unknown;
  workspace_id?: unknown;
  model?: unknown;
  message_id?: unknown;
  created_at?: unknown;
}

/** 云端原始分页字段。 */
export interface RawSessionPagePayload {
  total?: unknown;
  page?: unknown;
  page_size?: unknown;
  rows?: unknown;
}
