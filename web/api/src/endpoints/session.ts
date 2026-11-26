import { defineEndpoint } from "../core";
import type {
  SessionResponse,
  SessionCreateRequest,
  SessionListRequest,
  SessionPageResponse,
  SessionUpdateRequest,
} from "../types";

export const SESSION_ENDPOINTS = {
  list: defineEndpoint<SessionListRequest, SessionPageResponse>(
    "GET",
    "/api/cloud/common/api/sessions",
  ),
  create: defineEndpoint<SessionCreateRequest, SessionResponse>(
    "POST",
    "/api/cloud/common/api/sessions",
  ),
  get: defineEndpoint<
    {sessionId: string; workspaceId: string | number},
    SessionResponse
  >(
    "GET",
    "/api/cloud/common/api/sessions/{sessionId}",
  ),
  update: defineEndpoint<
    {sessionId: string; request: SessionUpdateRequest},
    SessionResponse
  >(
    "PUT",
    "/api/cloud/common/api/sessions/{sessionId}",
  ),
} as const;

/** 会话接口。 */
export interface SessionApi {
  list: typeof SESSION_ENDPOINTS.list;
  create: typeof SESSION_ENDPOINTS.create;
  get: typeof SESSION_ENDPOINTS.get;
  update: typeof SESSION_ENDPOINTS.update;
}
