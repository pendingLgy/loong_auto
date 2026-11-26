import {
  AUTH_ENDPOINTS,
  type Endpoint,
  EVENT_ENDPOINTS,
  HEALTH_ENDPOINTS,
  MESSAGE_ENDPOINTS,
  SESSION_CONFIG_ENDPOINTS,
  SESSION_ENDPOINTS,
  SUPPLIER_CONFIG_ENDPOINTS,
  TOOL_ENDPOINTS,
  WORKSPACE_ENDPOINTS,
} from "@loong/web-api";

import {readAuthSession} from "../../store/auth";
import {readLocale} from "../../store/locale";
import {HttpRequestError, HttpUnauthorizedError} from "./errors";
import {createHttpClient, type HttpClientConfig} from "./request";

export interface ApiConfig extends HttpClientConfig {
  timeoutMs: number;
  token?: string;
  securityToken?: string;
  locale?: string;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: "http://127.0.0.1:9528",
  timeoutMs: 5_000,
};

type EndpointFn<T> = T extends Endpoint<infer TReq, infer TRes>
  ? [TReq] extends [void]
    ? (init?: RequestInit) => Promise<TRes>
    : (params: TReq, init?: RequestInit) => Promise<TRes>
  : never;

type BoundModule<T extends Record<string, Endpoint<any, any>>> = {
  [K in keyof T]: EndpointFn<T[K]>;
};

function thisMessage(response: Response, body: unknown): string {
  if (body && typeof body === "object" && "msg" in body) {
    const msg = (body as {msg?: unknown}).msg;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return `请求失败：${response.status} ${response.statusText}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

async function send<TReq, TRes>(
  ep: Endpoint<TReq, TRes>,
  config: ApiConfig,
  params?: TReq,
  init?: RequestInit,
): Promise<TRes> {
  const isGet = ep.method === "GET";
  const headers = new Headers(config.headers);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  if (config.token) headers.set("Authorization", `Bearer ${config.token}`);
  if (config.securityToken) headers.set("X-Security-Token", config.securityToken);
  if (config.locale) headers.set("Accept-Language", config.locale);

  const http = createHttpClient({
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    headers,
    fetch: config.fetch,
    translate: config.translate,
  });

  const response = await http.request(ep.path, {
    method: ep.method,
    query: isGet && params && typeof params === "object"
      ? params as Record<string, string | number | boolean | null | undefined>
      : undefined,
    body: !isGet ? params : undefined,
    signal: init?.signal ?? undefined,
  });
  let body: unknown;
  try {
    body = await parseResponse(response);
  } catch (reason) {
    if (response.ok) throw reason;
    body = undefined;
  }
  const message = !response.ok ? thisMessage(response, body) : "";

  if (!response.ok) {
    if (response.status === 401) {
      throw new HttpUnauthorizedError(message, response.status, body);
    }
    throw new HttpRequestError(message, response.status, body);
  }

  if (body && typeof body === "object" && "code" in body) {
    const envelope = body as { code?: number; msg?: string; data?: TRes };
    if (envelope.code === 401) {
      throw new HttpUnauthorizedError(envelope.msg ?? "未登录或登录已过期");
    }
    if (envelope.code !== 200) {
      throw new HttpRequestError(envelope.msg ?? "请求失败");
    }
    return envelope.data as TRes;
  }
  return body as TRes;
}

function isRequestInit(value: unknown): value is RequestInit {
  if (typeof value !== "object" || value === null) return false;
  const initKeys = ["headers", "signal", "credentials", "mode", "cache", "redirect"];
  return initKeys.some((key) => key in value);
}

function bindModule<T extends Record<string, Endpoint<any, any>>>(
  endpoints: T,
  config: ApiConfig,
): BoundModule<T> {
  const bound = {} as BoundModule<T>;

  for (const key of Object.keys(endpoints) as Array<keyof T>) {
    const ep = endpoints[key];
    bound[key] = ((arg1?: unknown, arg2?: RequestInit) => {
      const hasParams =
        arg2 !== undefined || (arg1 !== undefined && !isRequestInit(arg1));
      return hasParams
        ? send(ep, config, arg1, arg2)
        : send(ep, config, undefined, arg1 as RequestInit | undefined);
    }) as EndpointFn<T[typeof key]>;
  }

  return bound;
}

export function api_client(override?: Partial<ApiConfig>) {
  const config: ApiConfig = {
    ...DEFAULT_API_CONFIG,
    token: readAuthSession()?.accessToken,
    locale: readLocale(),
    ...override,
  };

  return {
    auth: bindModule(AUTH_ENDPOINTS, config),
    health: bindModule(HEALTH_ENDPOINTS, config),
    sessionConfig: bindModule(SESSION_CONFIG_ENDPOINTS, config),
    supplierConfig: bindModule(SUPPLIER_CONFIG_ENDPOINTS, config),
    workspace: bindModule(WORKSPACE_ENDPOINTS, config),
    session: bindModule(SESSION_ENDPOINTS, config),
    message: bindModule(MESSAGE_ENDPOINTS, config),
    events: bindModule(EVENT_ENDPOINTS, config),
    tools: bindModule(TOOL_ENDPOINTS, config),
  };
}

