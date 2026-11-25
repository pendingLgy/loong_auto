/** 工作目录（cloud `/api/workspace`）相关类型。 */

export interface Workspace {
  id: string;
  tenantId: string;
  userId: string;
  name: string | null;
  path: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WorkspaceCreateRequest {
  name: string;
  /** 工作目录路径列表，提交时序列化为 JSON 数组字符串。 */
  path: string[];
}

export interface WorkspaceUpdateRequest {
  name: string;
  /** 工作目录路径列表，提交时序列化为 JSON 数组字符串。 */
  path: string[];
}

export interface WorkspaceListParams {
  page?: number;
  pageSize?: number;
}

export interface WorkspacePage {
  total: number | null;
  page: number | null;
  pageSize: number | null;
  rows: Workspace[];
}

/** 云端原始工作目录字段。 */
export interface RawWorkspacePayload {
  id?: unknown;
  tenant_id?: unknown;
  user_id?: unknown;
  name?: unknown;
  path?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

/** 云端原始分页字段。 */
export interface RawWorkspacePagePayload {
  total?: unknown;
  page?: unknown;
  page_size?: unknown;
  rows?: unknown;
}
