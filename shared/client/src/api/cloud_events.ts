import { Effect } from "effect";

import { requestJson, type HttpClientOptions } from "../http";
import type { AddMessageRequest, EventSubmitHeaders } from "../types";
import { ClientError } from "../types/errors";

function segment(value: string): string {
  return encodeURIComponent(value);
}

/** 对话事件接口：SSE 订阅与消息提交。 */
export class EventsApi {
  constructor(private readonly options: HttpClientOptions) {}

  /**
   * 建立当前会话的 SSE 订阅，返回原始流响应。
   *
   * 流由调用方消费并负责关闭；网关固定为当前本地客户端分配 `client_id`。
   */
  subscribe(_clientId: string, signal?: AbortSignal): Effect.Effect<Response, ClientError> {
    return requestJson<Response>(this.options, "/api/cloud/sse/subscribe", {
      headers: { Accept: "text/event-stream" },
      signal,
      parse: async (response) => {
        if (!response.ok) {
          throw new ClientError("建立事件订阅失败", response.status);
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.startsWith("text/event-stream")) {
          throw new ClientError("服务端未返回 SSE 流", response.status);
        }
        return response;
      },
    });
  }

  /** 提交一轮消息，结果通过已建立的 SSE 订阅推送。 */
  submit(
    _clientId: string,
    sessionId: string,
    request: AddMessageRequest,
    headers?: EventSubmitHeaders,
  ): Effect.Effect<void, ClientError> {
    return requestJson<void>(this.options, `/api/cloud/session/${segment(sessionId)}/message`, {
      method: "POST",
      headers,
      body: {
        tenant_id: request.tenantId,
        user_id: request.userId,
        workspace_id: request.workspaceId,
        session_id: request.sessionId,
        session_title: request.sessionTitle,
        llm: {
          provider: request.llm.provider ?? "openai",
          model: request.llm.model,
          temperature: request.llm.temperature ?? 1,
          api_key: request.llm.apiKey ?? null,
        },
        tools: request.tools,
        messages: request.messages,
      },
    }).pipe(Effect.map(() => undefined));
  }
}
