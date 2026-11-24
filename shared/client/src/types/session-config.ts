/** 会话配置（session_config 接口）的请求与响应类型。 */

export type WorkspaceMode = "read_only" | "workspace_write" | "full";

/** session_config 接口返回的会话配置。 */
export interface SessionConfig {
  sessionId: string;
  workspaceMode: WorkspaceMode;
  workspaces: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

/** 创建或覆盖会话配置。 */
export interface SessionConfigSaveRequest {
  workspaceId: string | number;
  workspaceMode: WorkspaceMode;
  workspaces: string[];
}

/** 局部更新会话配置：只提交需要修改的字段。 */
export interface SessionConfigUpdateRequest {
  workspaceMode?: WorkspaceMode;
  workspaces?: string[];
}

/** 云端/网关原始会话配置字段。 */
export interface RawSessionConfigPayload {
  session_id?: unknown;
  workspace_mode?: unknown;
  workspaces?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}
