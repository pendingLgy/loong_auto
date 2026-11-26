import { defineEndpoint } from "../core";
import type {
  SessionConfig,
  SessionConfigSaveRequest,
  SessionConfigUpdateRequest,
} from "../types";

export const SESSION_CONFIG_ENDPOINTS = {
  get: defineEndpoint<void, SessionConfig>(
    "GET",
    "/api/session-configs/{sessionId}",
  ),
  save: defineEndpoint<SessionConfigSaveRequest, SessionConfig>(
    "PUT",
    "/api/session-configs/{sessionId}",
  ),
  update: defineEndpoint<SessionConfigUpdateRequest, SessionConfig>(
    "PATCH",
    "/api/session-configs/{sessionId}",
  ),
  remove: defineEndpoint<void, void>(
    "DELETE",
    "/api/session-configs/{sessionId}",
  ),
} as const;

/** 会话配置接口。 */
export interface SessionConfigApi {
  get: typeof SESSION_CONFIG_ENDPOINTS.get;
  save: typeof SESSION_CONFIG_ENDPOINTS.save;
  update: typeof SESSION_CONFIG_ENDPOINTS.update;
  remove: typeof SESSION_CONFIG_ENDPOINTS.remove;
}
