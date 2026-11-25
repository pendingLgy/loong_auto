import type {
  SessionConfig,
  SessionConfigSaveRequest,
  SessionConfigUpdateRequest,
} from "../types";
import type { ApiEndpoint } from "../config";

export interface GetSessionConfigEndpoint
  extends ApiEndpoint<void, SessionConfig, "GET", "/api/session-configs/{sessionId}"> {}

export interface SaveSessionConfigEndpoint
  extends ApiEndpoint<SessionConfigSaveRequest, SessionConfig, "PUT", "/api/session-configs/{sessionId}"> {}

export interface UpdateSessionConfigEndpoint
  extends ApiEndpoint<SessionConfigUpdateRequest, SessionConfig, "PATCH", "/api/session-configs/{sessionId}"> {}

export interface RemoveSessionConfigEndpoint
  extends ApiEndpoint<void, void, "DELETE", "/api/session-configs/{sessionId}"> {}

/** 会话配置接口。 */
export interface SessionConfigApi {
  get: GetSessionConfigEndpoint;
  save: SaveSessionConfigEndpoint;
  update: UpdateSessionConfigEndpoint;
  remove: RemoveSessionConfigEndpoint;
}
