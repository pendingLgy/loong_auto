/** 工作目录（cloud `/api/workspace`）相关类型。 */

export interface WorkspaceResponse {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string | null;
  path: string[];
  created_at: string | null;
  updated_at: string | null;
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

export interface WorkspaceListRequest {
  page?: number;
  page_size?: number;
}

export interface WorkspacePageResponse {
  total: number | null;
  page: number | null;
  page_size: number | null;
  rows: WorkspaceResponse[];
}

/** 云端原始工作目录字段。 */
export interface RawWorkspaceResponse {
  id?: unknown;
  tenant_id?: unknown;
  user_id?: unknown;
  name?: unknown;
  path?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

/** 云端原始分页字段。 */
export interface RawWorkspacePageResponse {
  total?: unknown;
  page?: unknown;
  page_size?: unknown;
  rows?: unknown;
}
