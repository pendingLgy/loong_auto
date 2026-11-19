/** 本地网关调用错误；`status` 为 HTTP 状态码，`code` 为云端信封 code。 */
export class ClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: number,
  ) {
    super(message);
    this.name = "ClientError";
  }
}

/**
 * 401：未登录或登录已过期。
 *
 * 调用方可以单独捕获它做特殊处理（清理本地会话、跳转登录页、触发刷新令牌等），
 * 其余错误仍按 `ClientError` 处理。
 */
export class UnauthorizedError extends ClientError {
  constructor(message = "未登录或登录已过期") {
    super(message, 401, 401);
    this.name = "UnauthorizedError";
  }
}

/** 判断是否为 401 异常。 */
export function isUnauthorized(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}

/** 兼容旧命名。 */
export { ClientError as LoginError };
