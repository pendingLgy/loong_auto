import { resolveTemplate } from "@solid-primitives/i18n";

import { enUS, type MessageKey } from "./dictionaries";

export type Locale = "zh-CN" | "en-US";

/**
 * 默认语言：中文。
 *
 * 中文不维护字典：调用方通过 `translate(locale, key, fallback)` 传入中文兜底文案，
 * 默认语言下直接使用 fallback。字典只维护其它语言（当前为 en-US）。
 */
export const DEFAULT_LOCALE: Locale = "zh-CN";

export const LOCALES: readonly Locale[] = ["zh-CN", "en-US"];

export type { MessageKey };

const dictionaries: Partial<Record<Locale, Record<MessageKey, string>>> = {
  "en-US": enUS,
};

/**
 * 按语言取文案。
 *
 * - 当前语言没有字典或缺少该 key 时，使用调用方传入的 `fallback`（中文兜底）；
 * - 没有 fallback 时退化为 key 本身；
 * - `params` 用于 `{{ name }}` 插值，fallback 同样支持插值。
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  fallback?: string,
  params?: Record<string, unknown>,
): string {
  const value = dictionaries[locale]?.[key];
  const template = typeof value === "string" && value.length > 0
    ? value
    : (fallback ?? key);

  return resolveTemplate(template, params ?? {});
}

export { enUS };
