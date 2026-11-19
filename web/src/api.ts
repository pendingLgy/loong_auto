import { createLocalClient, type LocalClient, type Locale } from "@loong/client";

import { serverConfig } from "./storage/server_config";
import { userSession } from "./storage/user";

/**
 * 创建指向本地网关的 API 客户端。
 *
 * - 地址与 security_token 来自服务器配置；
 * - 已登录时使用用户数据里的访问令牌。
 */
export function createApiClient(options: { origin?: string; locale?: Locale } = {}): LocalClient {
  const config = serverConfig();
  const origin = options.origin
    ?? config?.serverUrl
    ?? (typeof location === "undefined" ? "http://127.0.0.1:9528" : location.origin);

  return createLocalClient({
    origin,
    locale: options.locale,
    token: userSession()?.accessToken,
    security_token: config?.token,
  });
}
