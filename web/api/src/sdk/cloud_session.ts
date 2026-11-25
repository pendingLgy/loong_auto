import type {
  Session,
  SessionCreateRequest,
  SessionListParams,
  SessionPage,
  SessionUpdateRequest,
} from "../types";
import type { ApiEndpoint } from "../config";

export interface ListSessionEndpoint
  extends ApiEndpoint<SessionListParams, SessionPage, "GET", "/api/cloud/common/api/sessions"> {}

export interface CreateSessionEndpoint
  extends ApiEndpoint<SessionCreateRequest, Session, "POST", "/api/cloud/common/api/sessions"> {}

export interface GetSessionEndpoint
  extends ApiEndpoint<
    {sessionId: string; workspaceId: string | number},
    Session,
    "GET",
    "/api/cloud/common/api/sessions/{sessionId}"
  > {}

export interface UpdateSessionEndpoint
  extends ApiEndpoint<
    {sessionId: string; request: SessionUpdateRequest},
    Session,
    "PUT",
    "/api/cloud/common/api/sessions/{sessionId}"
  > {}

/** 会话接口。 */
export interface SessionApi {
  list: ListSessionEndpoint;
  create: CreateSessionEndpoint;
  get: GetSessionEndpoint;
  update: UpdateSessionEndpoint;
}
