/** 会话（cloud `/api/sessions`）相关类型。 */

export interface SessionResponse {
  id: string;
  tenant_id: string;
  user_id: string;
  session_id: string;
  session_title: string | null;
  workspace_id: string | null;
  model: string | null;
  message_id: string | null;
  created_at: string | null;
}

export interface SessionCreateRequest {
  session_id: string;
  session_title: string;
  workspace_id: string | number;
}

export interface SessionUpdateRequest {
  session_title?: string;
  workspace_id: string | number;
}

export interface SessionListRequest {
  workspace_id: string | number;
  page?: number;
  page_size?: number;
}

export interface SessionPageResponse {
  total: number | null;
  page: number | null;
  page_size: number | null;
  rows: SessionResponse[];
}

/** 云端原始会话字段。 */
export interface RawSessionResponse {
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
export interface RawSessionPageResponse {
  total?: unknown;
  page?: unknown;
  page_size?: unknown;
  rows?: unknown;
}
