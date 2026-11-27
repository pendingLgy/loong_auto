import { createContext, createSignal, useContext, type Accessor, type ParentProps } from "solid-js";

import { enUS, type UiMessageKey } from "./en-US";

export type { UiMessageKey } from "./en-US";

export type UiLocale = "zh-CN" | "en-US";
export type UiTranslateParams = Record<string, string | number>;
export type UiTranslate = (
  key: UiMessageKey,
  fallback: string,
  params?: UiTranslateParams,
) => string;

export interface UiI18nContextValue {
  locale: Accessor<UiLocale>;
  setLocale: (locale: UiLocale) => void;
  t: UiTranslate;
}

function format(template: string, params: UiTranslateParams): string {
  return template.replace(/\{([^}]+)\}/g, (_, name: string) =>
    String(params[name] ?? `{${name}}`));
}

const UiI18nContext = createContext<UiI18nContextValue>();

/** UI 组件库国际化上下文；中文作为调用方 fallback，英文由 en-US 词典提供。 */
export function UiI18nProvider(props: ParentProps<{locale?: UiLocale | Accessor<UiLocale>}>) {
  const externalLocale = typeof props.locale === "function" ? props.locale : undefined;
  const [internalLocale, setLocale] = createSignal<UiLocale>(
    typeof props.locale === "string" ? props.locale : "zh-CN",
  );
  const locale = externalLocale ?? internalLocale;
  const t: UiTranslate = (key, fallback, params = {}) =>
    format(locale() === "en-US" ? enUS[key] : fallback, params);

  return (
    <UiI18nContext value={{locale, setLocale, t}}>
      {props.children}
    </UiI18nContext>
  );
}

const fallback: UiI18nContextValue = {
  locale: () => "zh-CN",
  setLocale: () => {},
  t: (_key, message, params = {}) => format(message, params),
};

/** 读取 UI 国际化上下文；未包裹 Provider 时使用调用方 fallback。 */
export function useUiI18n(): UiI18nContextValue {
  return useContext(UiI18nContext) ?? fallback;
}
