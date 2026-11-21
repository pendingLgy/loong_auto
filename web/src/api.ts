import {Effect} from "effect";

import {
  createLocalClient,
  isUnauthorized,
  type LocalClient,
  type Locale,
  UnauthorizedError,
} from "@loong/client";

import {markAuthExpired} from "./storage/auth_notice";
import {activeServerId, serverConfig} from "./storage/server_config";
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

const refreshTasks = new Map<string, Effect.Effect<string, unknown>>();

function refreshAccessToken(
  serverId: string,
  origin: string,
  locale?: Locale,
): Effect.Effect<string, unknown> {
  const pending = refreshTasks.get(serverId);
  if (pending) return pending;

  const task = Effect.gen(function* () {
    const session = userSession();
    if (!session?.refreshToken) {
      return yield* Effect.fail(new UnauthorizedError("登录已过期，请重新登录"));
    }

    const client = buildClient(origin, locale);
    const token = yield* client.auth.refreshToken({ refreshToken: session.refreshToken });
    updateAccessToken(token, serverId);
    return token;
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        refreshTasks.delete(serverId);
      }),
    ),
  );

  refreshTasks.set(serverId, task);
  return task;
}

type EffectMethod = (...args: unknown[]) => Effect.Effect<unknown, unknown>;

function wrapNamespace<T extends object>(
  key: "auth" | "sessionConfig" | "supplierConfig",
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
                const serverId = activeServerId();
                if (serverId) clearUser(serverId);
                markAuthExpired();
              }
              return Effect.fail(error);
            }),
          );
        }

        return invoke().pipe(
          Effect.catchAll((error) => {
            if (!isUnauthorized(error)) {
              return Effect.fail(error);
            }

            const serverId = activeServerId();
            if (!serverId) {
              return Effect.fail(error);
            }

            return refreshAccessToken(serverId, origin, locale).pipe(
              Effect.flatMap((token) => invoke(token)),
              Effect.catchAll((refreshError) => {
                if (isUnauthorized(refreshError)) {
                  clearUser(serverId);
                  markAuthExpired();
                }
                return Effect.fail(refreshError);
              }),
            );
          }),
        );
      };
    },
  });
}

/**
 * 创建指向本地网关的 API 客户端。
 *
 * 业务接口返回 401 时，使用当前服务器的 refresh token 刷新一次，并重新提交原请求。
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
  };
}
