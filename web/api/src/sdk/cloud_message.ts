import type { MessageListParams, MessagePage } from "../types";
import type { ApiEndpoint } from "../config";

export interface ListMessageEndpoint
  extends ApiEndpoint<
    {sessionId: string; params?: MessageListParams},
    MessagePage,
    "GET",
    "/api/cloud/common/api/messages"
  > {}

/** 消息接口。 */
export interface MessageApi {
  list: ListMessageEndpoint;
}
