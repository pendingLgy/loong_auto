import { defineEndpoint } from "../core";
import type { MessageListParams, MessagePage } from "../types";

export const MESSAGE_ENDPOINTS = {
  list: defineEndpoint<
    {sessionId: string; params?: MessageListParams},
    MessagePage
  >(
    "GET",
    "/api/cloud/common/api/messages",
  ),
} as const;

/** 消息接口。 */
export interface MessageApi {
  list: typeof MESSAGE_ENDPOINTS.list;
}
