/** 消息（cloud `/api/messages`）相关类型。 */

export interface MessageRecord {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  model: string | null;
  messageId: string | null;
  created: string | null;
  role: string | null;
  content: string | null;
  toolCalls: Array<Record<string, unknown>>;
  toolCallId: string | null;
}

export interface MessageListParams {
  page?: number;
  pageSize?: number;
}

export interface MessagePage {
  total: number | null;
  page: number | null;
  pageSize: number | null;
  rows: MessageRecord[];
}

/** 云端原始消息字段。 */
export interface RawMessagePayload {
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
export interface RawMessagePagePayload {
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
export interface ToolApprovalMessage {
  id: string | null;
  role: string;
  status: string | null;
  content: string;
  tool_call_id: string | null;
}

/** 工具审批接口的原始 message 字段。 */
export interface RawToolApprovalMessagePayload {
  id?: unknown;
  role?: unknown;
  status?: unknown;
  content?: unknown;
  tool_call_id?: unknown;
}
