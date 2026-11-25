/** 错误类型复用 shared/client，避免 instanceof 判断出现双实例。 */
export {
  ClientError,
  HttpTimeoutError,
  UnauthorizedError,
  isUnauthorized,
} from "@loong/client";
