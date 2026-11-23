import { Effect } from "effect";

import type { LoginRequest, LoginResponse } from "../types";
import { ClientError } from "../types/errors";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import { AuthApi } from "./cloud_auth";
import { HealthApi } from "./local_health";
import { SessionConfigApi } from "./local_session_config";
import { SupplierConfigApi } from "./local_supplier_config";
import { WorkspaceApi } from "./cloud_workspace";
import { EventsApi } from "./cloud_events";
import { SessionApi } from "./cloud_session";
import { MessageApi } from "./cloud_message";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** 默认转发前缀：本地网关 `/api/common` 会把请求代理到云端 `/api/*`。 */
export const DEFAULT_PREFIX = "";

/** 登录接口路径（相对 `prefix`）。 */
export const LOGIN_PATH = "/api/auth/login";

export interface LocalClientOptions {
  /** 本地网关地址；必须是 localhost / 127.0.0.1 / ::1。 */
  origin: string;
  /** 路由转发前缀，默认 `/api/common`。 */
  prefix?: string;
  /** 访问令牌；登录后调用需要鉴权的接口时传入。 */
  token?: string;
  /** 错误文案语言，默认中文。 */
  locale?: Locale;
  fetch?: typeof fetch;

  security_token?: string;
  /** 请求超时时间（毫秒），默认 5000。 */
  timeoutMs?: number;
}

export interface LocalClient {
  origin: string;
  prefix: string;
  auth: AuthApi;
  health: HealthApi;
  sessionConfig: SessionConfigApi;
  supplierConfig: SupplierConfigApi;
  workspace: WorkspaceApi;
  session: SessionApi;
  message: MessageApi;
  events: EventsApi;
}

/** 只允许本机网关，拒绝把账号密码发往任意远程地址。 */
export function assertLocalGateway(
  origin: string,
  locale: Locale = DEFAULT_LOCALE,
): URL {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new ClientError(
      translate(locale, "client.errors.invalidGateway", "本地网关地址不合法"),
    );
  }
  if (!LOCAL_HOSTS.has(url.hostname) || !["http:", "https:"].includes(url.protocol)
      || url.username || url.password) {
    throw new ClientError(
      translate(locale, "client.errors.localGatewayOnly", "只能通过本地网关访问"),
    );
  }
  return url;
}

/** 创建本地网关客户端，按服务分组暴露接口（当前为 auth）。 */
export function createLocalClient(options: LocalClientOptions): LocalClient {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const baseUrl = assertLocalGateway(options.origin, locale);
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  return {
    origin: baseUrl.origin,
    prefix,
    auth: new AuthApi({
      baseUrl,
      prefix,
      token: options.token,
      locale,
      fetch: options.fetch,
      security_token: options.security_token,
      timeoutMs: options.timeoutMs
    }),
    health: new HealthApi({
      baseUrl,
      prefix,
      token: options.token,
      locale,
      fetch: options.fetch,
      security_token: options.security_token,
      timeoutMs: options.timeoutMs,
    }),
    sessionConfig: new SessionConfigApi({
      baseUrl,
      prefix,
      token: options.token,
      locale,
      fetch: options.fetch,
      security_token: options.security_token,
      timeoutMs: options.timeoutMs,
    }),
    supplierConfig: new SupplierConfigApi({
      baseUrl,
      prefix,
      token: options.token,
      locale,
      fetch: options.fetch,
      security_token: options.security_token,
      timeoutMs: options.timeoutMs,
    }),
    workspace: new WorkspaceApi({
      baseUrl,
      prefix,
      token: options.token,
      locale,
      fetch: options.fetch,
      security_token: options.security_token,
      timeoutMs: options.timeoutMs,
    }),
    session: new SessionApi({
      baseUrl,
      prefix,
      token: options.token,
      locale,
      fetch: options.fetch,
      security_token: options.security_token,
      timeoutMs: options.timeoutMs,
    }),
    message: new MessageApi({
      baseUrl,
      prefix,
      token: options.token,
      locale,
      fetch: options.fetch,
      security_token: options.security_token,
      timeoutMs: options.timeoutMs,
    }),
    events: new EventsApi({
      baseUrl,
      prefix,
      token: options.token,
      locale,
      fetch: options.fetch,
      security_token: options.security_token,
      timeoutMs: options.timeoutMs,
    }),
  };
}

/** 单函数登录入口，内部复用 `createLocalClient().auth.login`。 */
export function loginWithLocalGateway(
  request: LoginRequest,
  options: {
    origin?: string;
    prefix?: string;
    locale?: Locale;
    fetch?: typeof fetch;
  } = {},
): Effect.Effect<LoginResponse, ClientError> {
  const origin = options.origin
    ?? (typeof location === "undefined" ? "http://127.0.0.1:9528" : location.origin);
  return createLocalClient({
    origin,
    prefix: options.prefix,
    locale: options.locale,
    fetch: options.fetch,
  }).auth.login(request);
}
