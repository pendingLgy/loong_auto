/**
 * 本地网关客户端的错误文案。
 *
 * 与 `@loong/ui/i18n` 保持同样约定：默认为中文（中文以调用处 fallback 的形式内联），
 * 其它语言维护在 `enUS` 字典中；客户端不依赖 UI 包。
 */

export type Locale = "zh-CN" | "en-US";

/** 默认语言：中文。 */
export const DEFAULT_LOCALE: Locale = "zh-CN";

export const LOCALES: readonly Locale[] = ["zh-CN", "en-US"];

export const enUS = {
  "client.errors.invalidGateway": "Invalid local gateway URL",
  "client.errors.localGatewayOnly": "Only the local gateway is allowed",
  "client.errors.invalidJson": "Response is not valid JSON",
  "client.errors.requestFailed": "Request failed",
  "client.errors.unauthorized": "Not signed in or session expired",
  "client.errors.missingTokens": "Login response is missing tokens",
  "client.errors.missingAccessToken": "Refresh response is missing the access token",
  "client.errors.invalidSessionConfig": "Session config response is invalid",
} as const;

export type MessageKey = keyof typeof enUS;

/** 按语言取文案；中文直接返回调用处传入的 fallback。 */
export function translate(locale: Locale, key: MessageKey, fallback: string): string {
  if (locale === "en-US") {
    return enUS[key];
  }
  return fallback;
}
