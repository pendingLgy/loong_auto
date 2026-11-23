import {Effect} from "effect";

import {
  createLocalClient,
  isUnauthorized,
  ClientError,
  type LocalClient,
  type Locale,
  UnauthorizedError,
} from "@loong/client";

import {markAuthExpired} from "./storage/auth_notice";
import {showNotice} from "./storage/app_notice";
import {serverConfig} from "./storage/server_config";
import {clearUser, updateAccessToken, userSession} from "./storage/user";


function buildClient(origin: string, locale?: Locale, token?: string): LocalClient {
  const config = serverConfig();
  return createLocalClient({
    origin,
    locale,
    token: token ?? userSession()?.accessToken,
    security_token: config?.token,
  });
}

let refreshTask: Effect.Effect<string, unknown> | undefined;

/** 同一接口 + 参数 3 秒内只允许提交一次。 */
const lastRequests = new Map<string, number>();

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function getRequestMethod(target: object, property: string): HttpMethod | undefined {
  const methods = (target.constructor as {
    httpMethods?: Record<string, HttpMethod>;
  }).httpMethods;
  return methods?.[property];
}

function asClientError(cause: unknown): ClientError {


  return new ClientError(cause instanceof Error ? cause.message : String(cause));
}

function requestKey(namespace: string, method: string, args: unknown[]): string {
  let raw: string;
  try {
    raw = JSON.stringify(args);
  } catch {
    raw = String(args);
  }
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${namespace}.${method}:${(hash >>> 0).toString(16)}`;
}

function refreshAccessToken(
  origin: string,
  locale?: Locale,
): Effect.Effect<string, unknown> {
  if (refreshTask) return refreshTask;

  const task = Effect.gen(function* () {
    const session = userSession();
    if (!session?.refreshToken) {
      return yield* Effect.fail(new UnauthorizedError("登录已过期，请重新登录"));
    }

    const client = yield* Effect.try({
      try: () => buildClient(origin, locale),
      catch: (cause) => asClientError(cause),
    });
    const token = yield* client.auth.refreshToken({ refreshToken: session.refreshToken });
    updateAccessToken(token);
    return token;
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        refreshTask = undefined;
      }),
    ),
  );

  refreshTask = task;
  return task;
}

type EffectMethod = (...args: unknown[]) => Effect.Effect<unknown, unknown>;

function wrapNamespace<T extends object>(
  key: "auth" | "sessionConfig" | "supplierConfig" | "workspace" | "session" | "message" | "events",
  target: T,
  origin: string,
  locale: Locale | undefined,
  skip: ReadonlySet<string> = new Set(),
): T {
  return new Proxy(target, {
    get(object, property) {
      const value = Reflect.get(object, property);
      if (typeof value !== "function" || skip.has(String(property))) {
        return value;
      }

      return (...args: unknown[]) => {
        const invoke = (token?: string) => {
          const client = buildClient(origin, locale, token);
          const namespace = client[key] as unknown as Record<string, EffectMethod>;
          return namespace[String(property)](...args);
        };

        // 直接调用 refresh_token 返回 401 时，同样触发登录过期提示；不再次自动刷新。
        if (property === "refreshToken") {
          return invoke().pipe(
            Effect.catchAll((error) => {
              if (isUnauthorized(error)) {
                clearUser();
                markAuthExpired();
              }
              return Effect.fail(error);
            }),
          );
        }

        const cacheKey = requestKey(key, String(property), args);
        const now = Date.now();
        const last = lastRequests.get(cacheKey) ?? 0;
        const readRequest = getRequestMethod(object, String(property)) === "GET";
        if (!readRequest && now - last < 3000) {
          showNotice("warning", "操作太频繁，请稍后再试");
          return Effect.fail(new ClientError("操作太频繁，请稍后再试", 429));
        }
        if (!readRequest) lastRequests.set(cacheKey, now);

        const execute = () => invoke().pipe(
          Effect.catchAll((error) => {

            if (error instanceof ClientError){
              showNotice("error", error.message);
              return Effect.fail(error);
            }

            if (!isUnauthorized(error)) {
              return Effect.fail(error);
            }

            return refreshAccessToken(origin, locale).pipe(
              Effect.flatMap((token) => invoke(token)),
              Effect.catchAll((refreshError) => {
                if (isUnauthorized(refreshError)) {
                  clearUser();
                  markAuthExpired();
                }
                return Effect.fail(refreshError);
              }),
            );
          }),
          Effect.tap(() => Effect.sync(() => lastRequests.delete(cacheKey))),
        );

        return execute();
      };
    },
  });
}

/**
 * 创建指向唯一本地网关的 API 客户端。
 *
 * 业务接口返回 401 时使用唯一 refresh token 刷新一次并重试。
 */
export function createApiClient(options: { origin?: string; locale?: Locale } = {}): LocalClient {
  const config = serverConfig();
  const origin = options.origin
    ?? config?.serverUrl
    ?? (typeof location === "undefined" ? "http://127.0.0.1:9528" : location.origin);

  const base = buildClient(origin, options.locale);
  return {
    ...base,
    auth: wrapNamespace(
      "auth",
      base.auth,
      origin,
      options.locale,
      new Set(["login", "register"]),
    ),
    sessionConfig: wrapNamespace("sessionConfig", base.sessionConfig, origin, options.locale),
    supplierConfig: wrapNamespace("supplierConfig", base.supplierConfig, origin, options.locale),
    workspace: wrapNamespace("workspace", base.workspace, origin, options.locale),
    session: wrapNamespace("session", base.session, origin, options.locale),
    message: wrapNamespace("message", base.message, origin, options.locale),
    events: wrapNamespace("events", base.events, origin, options.locale),
  };
}
