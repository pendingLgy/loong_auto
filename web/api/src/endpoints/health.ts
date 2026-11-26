import { defineEndpoint } from "../core";

export const HEALTH_ENDPOINTS = {
  securityToken: defineEndpoint<void, void>(
    "GET",
    "/api/health/security_token",
  ),
} as const;

/** 健康检查接口。 */
export interface HealthApi {
  securityToken: typeof HEALTH_ENDPOINTS.securityToken;
}
