import { defineEndpoint } from "../core";
import type { MessageListRequest, MessagePageResponse } from "../types";

export const MESSAGE_ENDPOINTS = {
  list: defineEndpoint<
    {sessionId: string; params?: MessageListRequest},
    MessagePageResponse
  >(
    "GET",
    "/api/cloud/common/api/messages",
  ),
} as const;

/** 消息接口。 */
export interface MessageApi {
  list: typeof MESSAGE_ENDPOINTS.list;
}
