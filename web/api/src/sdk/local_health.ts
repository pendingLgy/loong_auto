import type { ApiEndpoint } from "../config";

export interface SecurityTokenEndpoint
  extends ApiEndpoint<void, void, "GET", "/api/health/security_token"> {}

/** 健康检查接口。 */
export interface HealthApi {
  securityToken: SecurityTokenEndpoint;
}
