import { Effect } from "effect";

import { requestJson, type HttpClientOptions } from "../http";
import { ClientError } from "../types/errors";

/** 健康检查属于本地网关路由，不经过云端转发前缀。 */
const LOCAL_PREFIX = "/";

/** 本地服务健康检查。 */
export class HealthApi {
  static readonly httpMethods = {security_token: "GET"} as const;


  constructor(private readonly options: HttpClientOptions) {}

  /** 用 `X-Security-Token` 校验本地网关的 security_token 是否正确。 */
  security_token(): Effect.Effect<void, ClientError> {
    return requestJson<unknown>(this.options, "/api/health/security_token", {
      prefix: LOCAL_PREFIX,
    }).pipe(Effect.map(() => undefined));
  }
}
