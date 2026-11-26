/** HTTP 请求错误基类。 */
export class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

/** 请求超时。 */
export class HttpTimeoutError extends HttpRequestError {
  constructor(message: string, data?: unknown) {
    super(message, 408, data);
    this.name = "HttpTimeoutError";
  }
}

/** 认证失败 / 登录过期。 */
export class HttpUnauthorizedError extends HttpRequestError {
  constructor(message: string, status = 401, data?: unknown) {
    super(message, status, data);
    this.name = "HttpUnauthorizedError";
  }
}
