import { defineEndpoint } from "../core";
import type {
  Session,
  SessionCreateRequest,
  SessionListParams,
  SessionPage,
  SessionUpdateRequest,
} from "../types";

export const SESSION_ENDPOINTS = {
  list: defineEndpoint<SessionListParams, SessionPage>(
    "GET",
    "/api/cloud/common/api/sessions",
  ),
  create: defineEndpoint<SessionCreateRequest, Session>(
    "POST",
    "/api/cloud/common/api/sessions",
  ),
  get: defineEndpoint<
    {sessionId: string; workspaceId: string | number},
    Session
  >(
    "GET",
    "/api/cloud/common/api/sessions/{sessionId}",
  ),
  update: defineEndpoint<
    {sessionId: string; request: SessionUpdateRequest},
    Session
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
