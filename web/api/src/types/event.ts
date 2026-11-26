/** 对话事件（cloud `/api/events`）相关类型。 */

export interface EventLLMParamRequest {
  provider?: string;
  model: string;
  temperature?: number | null;
  api_key?: string | null;
}

/** 提交一轮对话事件。 */
export interface AddMessageRequest {
  tenant_id: string;
  user_id: string;
  workspace_id: string;
  session_id: string;
  session_title: string;
  llm: EventLLMParamRequest;
  tools: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
}

export interface EventSubmitHeadersRequest {
  [name: string]: string;
}
