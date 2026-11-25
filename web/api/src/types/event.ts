/** 对话事件（cloud `/api/events`）相关类型。 */

export interface EventLLMParam {
  provider?: string;
  model: string;
  temperature?: number | null;
  apiKey?: string | null;
}

/** 提交一轮对话事件。 */
export interface AddMessageRequest {
  tenantId: string;
  userId: string;
  workspaceId: string;
  sessionId: string;
  sessionTitle: string;
  llm: EventLLMParam;
  tools: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
}

export interface EventSubmitHeaders {
  [name: string]: string;
}
