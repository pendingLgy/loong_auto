import { defineEndpoint } from "../core";
import type { AddMessageRequest, EventSubmitHeaders } from "../types";

export const EVENT_ENDPOINTS = {
  subscribe: defineEndpoint<
    {clientId: string; signal?: AbortSignal},
    Response
  >(
    "GET",
    "/api/cloud/sse/subscribe",
  ),
  submit: defineEndpoint<
    {
      clientId: string;
      sessionId: string;
      request: AddMessageRequest;
      headers?: EventSubmitHeaders;
    },
    void
  >(
    "POST",
    "/api/cloud/session/{sessionId}/message",
  ),
} as const;

/** 事件接口。 */
export interface EventsApi {
  subscribe: typeof EVENT_ENDPOINTS.subscribe;
  submit: typeof EVENT_ENDPOINTS.submit;
}
