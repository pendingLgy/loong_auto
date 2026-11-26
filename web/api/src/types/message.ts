/** 消息（cloud `/api/messages`）相关类型。 */

export interface MessageResponse {
  id: string;
  tenant_id: string;
  user_id: string;
  session_id: string;
  model: string | null;
  message_id: string | null;
  created: string | null;
  role: string | null;
  content: string | null;
  tool_calls: Array<Record<string, unknown>>;
  tool_call_id: string | null;
}

export interface MessageListRequest {
  page?: number;
  page_size?: number;
}

export interface MessagePageResponse {
  total: number | null;
  page: number | null;
  page_size: number | null;
  rows: MessageResponse[];
}

/** 云端原始消息字段。 */
export interface RawMessageResponse {
  id?: unknown;
  tenant_id?: unknown;
  user_id?: unknown;
  session_id?: unknown;
  model?: unknown;
  message_id?: unknown;
  created?: unknown;
  role?: unknown;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
}

/** 云端原始分页字段。 */
export interface RawMessagePageResponse {
  total?: unknown;
  page?: unknown;
  page_size?: unknown;
  rows?: unknown;
}


/** 工具审批请求。 */
export interface ToolApprovalRequest {
  approved: boolean;
}

/** 工具审批执行后返回的 tool 消息。 */
export interface ToolApprovalResponse {
  id: string | null;
  role: string;
  status: string | null;
  content: string;
  tool_call_id: string | null;
}

/** 工具审批接口的原始 message 字段。 */
export interface RawToolApprovalMessageResponse {
  id?: unknown;
  role?: unknown;
  status?: unknown;
  content?: unknown;
  tool_call_id?: unknown;
}
