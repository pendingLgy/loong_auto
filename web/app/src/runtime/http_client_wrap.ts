import {Cause, Effect, Exit, Option} from "effect";

import {readAuthSession, saveAuthSession} from "../store/auth";
import {
  request_client,
  type ApiClient,
  type ApiConfig,
  DEFAULT_API_CONFIG,
  HttpRequestError,
  HttpUnauthorizedError, HttpRefreshTokenExpiredError
} from "./http";

export interface CreateWrappedClientOptions {
  override?: Partial<ApiConfig>;
  onError?: (message: string) => void;
  onSessionExpired?: () => void;
}

type CallableMethod = (...fnArgs: unknown[]) => unknown;
type ClientDictionary = Record<string, Record<string, unknown> | undefined>;


export function toErrorMessage(error: unknown): string {
  if (error instanceof HttpRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

function resolveMethod(
  override: Partial<ApiConfig> | undefined,
  moduleKey: keyof ApiClient,
  method: string,
): CallableMethod {
  // 每次调用都重新执行 request_client(override)，读取最新的 access_token / user_token / locale
  const latestClient = request_client(override) as unknown as ClientDictionary;
  const targetFn = latestClient[moduleKey]?.[method];
  if (typeof targetFn !== "function") {
    throw new HttpRequestError(`接口不存在：${String(moduleKey)}.${method}`);
  }
  return targetFn as CallableMethod;
}

function runUnwrapped<A, E>(effect: Effect.Effect<A, E, never>): Promise<A> {
  return Effect.runPromiseExit(effect).then((exit) => {
    if (Exit.isSuccess(exit)) {
      return exit.value;
    }

    // 1. 提取 Effect.fail(...) 里的原始错误对象
    const failure = Cause.failureOption(exit.cause);
    if (Option.isSome(failure)) {
      return Promise.reject(failure.value);
    }

    // 2. 如果是未捕获的运行时崩溃 (Die)，提取原始异常避免泄露 FiberFailure
    const defect = Cause.dieOption(exit.cause);
    if (Option.isSome(defect)) {
      return Promise.reject(defect.value);
    }

    // 3. 兜底（如 Fiber 中断等）
    return Promise.reject(new Error(Cause.pretty(exit.cause)));
  });
}


let sharedRefreshInflight: Promise<string> | null = null;


export function createWrappedApiClient(
  options: CreateWrappedClientOptions = {},
): ApiClient {
  const {override, onError, onSessionExpired} = options;

  const notifyError = (message: string) => {
    onError?.(message);
  };

  const refreshAccessToken = (failedToken?: string): Promise<string> => {

    // 1. 已有正在进行的刷新请求，所有并发 401 直接复用同一个 Promise
    if (sharedRefreshInflight) {
      return sharedRefreshInflight;
    }

    // 2. 二次检查：如果本地 access_token 已经被前一个刷新动作更新，直接复用新 token
    const currentSession = readAuthSession();
    if (
      currentSession?.access_token &&
      failedToken &&
      currentSession.access_token !== failedToken
    ) {
      return Promise.resolve(currentSession.access_token);
    }


    const program = Effect.gen(function* () {
      const session = readAuthSession();
      if (!session?.refresh_token) {
        return yield* Effect.fail(new HttpRefreshTokenExpiredError("登录过期，请重新登录"));
      }

      const nextToken = yield* Effect.tryPromise({
        try: () =>
          request_client({
            baseUrl: override?.baseUrl,
            timeoutMs: override?.timeoutMs ?? DEFAULT_API_CONFIG.timeoutMs,
            securityToken: override?.securityToken,
          }).auth.refreshToken({
            refresh_token: session.refresh_token,
          }),
        catch: (err) => err,
      }).pipe(
        Effect.catchAll((err) => {
          const msg =
            err instanceof Error ? err.message : "刷新登录状态失败，请重新登录";
          return Effect.fail(new HttpRefreshTokenExpiredError(msg));
        }),
      );

      if (typeof nextToken !== "string" || !nextToken) {
        return yield* Effect.fail(
          new HttpRefreshTokenExpiredError("刷新令牌响应缺少 access_token"),
        );
      }

      saveAuthSession({...session, access_token: nextToken});
      return nextToken;
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          notifyError(toErrorMessage(error));
          if (error instanceof HttpRefreshTokenExpiredError) {
            onSessionExpired?.();
          }
        }),
      ),
    );

    // extract HttpRequestError
    sharedRefreshInflight = runUnwrapped(program).finally(() => {
      sharedRefreshInflight = null;
    });

    return sharedRefreshInflight;
  };

  // 仅作为 Proxy 壳挂载点，实际每次调用都走 resolveMethod 获取最新实例
  const proxyTarget = request_client(override);

  return new Proxy(proxyTarget as object, {
    get(target, moduleProp, receiver) {
      const mod = Reflect.get(target, moduleProp, receiver);
      if (typeof moduleProp === "symbol" || !mod || typeof mod !== "object") {
        return mod;
      }

      const moduleKey = String(moduleProp) as keyof ApiClient;

      return new Proxy(mod as object, {
        get(modTarget, methodProp, modReceiver) {
          const fn = Reflect.get(modTarget, methodProp, modReceiver);
          if (typeof methodProp === "symbol" || typeof fn !== "function") {
            return fn;
          }

          const method = String(methodProp);
          const isRefreshCall = moduleKey === "auth" && method === "refreshToken";

          return (...args: unknown[]) => {
            const executeOnce = () =>
              Effect.tryPromise({
                try: () => {
                  const currentFn = resolveMethod(override, moduleKey, method);
                  return Promise.resolve(currentFn(...args));
                },
                catch: (error) => error,
              });

            const effect = executeOnce().pipe(
              Effect.catchAll((error) => {
                // not 401 handler
                if (!(error instanceof HttpUnauthorizedError) || isRefreshCall) {
                  notifyError(toErrorMessage(error));
                  const wrapped =
                    error instanceof HttpRequestError
                      ? error
                      : new HttpRequestError(String(error));
                  return Effect.fail(wrapped);
                }

                // 401 handler
                return Effect.gen(function* () {
                  const requestToken = readAuthSession()?.access_token || "fail_token";
                  yield* Effect.tryPromise({
                    try: () => refreshAccessToken(requestToken),
                    catch: (reason) => reason,
                  });

                  // 刷新完成后再次调用 resolveMethod，读取刚写入的新 access_token 重放请求
                  return yield* executeOnce();
                }).pipe(
                  Effect.catchAll((retryError) => {
                    const wrapped =
                      retryError instanceof HttpRequestError
                        ? retryError
                        : new HttpRequestError(String(retryError));

                    notifyError(toErrorMessage(wrapped));
                    return Effect.fail(wrapped);
                  }),
                );
              }),
            );

            return runUnwrapped(effect);
          };
        },
      });
    },
  }) as ApiClient;
}
