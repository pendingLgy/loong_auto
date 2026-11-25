import type { AddMessageRequest, EventSubmitHeaders } from "../types";
import type { ApiEndpoint } from "../config";

export interface SubscribeEventEndpoint
  extends ApiEndpoint<
    {clientId: string; signal?: AbortSignal},
    Response,
    "GET",
    "/api/cloud/sse/subscribe"
  > {}

export interface SubmitEventEndpoint
  extends ApiEndpoint<
    {
      clientId: string;
      sessionId: string;
      request: AddMessageRequest;
      headers?: EventSubmitHeaders;
    },
    void,
    "POST",
    "/api/cloud/session/{sessionId}/message"
  > {}

/** 事件接口。 */
export interface EventsApi {
  subscribe: SubscribeEventEndpoint;
  submit: SubmitEventEndpoint;
}
