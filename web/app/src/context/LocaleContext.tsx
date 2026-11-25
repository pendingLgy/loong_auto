import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js";

import { enUS, type MessageKey, type Messages } from "../runtime/i18n/en-US";
import { readLocale, saveLocale, type Locale } from "../store/locale";

export type {Locale, MessageKey, Messages};

const DICTIONARIES: Partial<Record<Locale, Messages>> = {
  "en-US": enUS,
};

type TranslateParams = Record<string, string | number>;

export interface Translate {
  (key: MessageKey, fallback?: string, params?: TranslateParams): string;
  (key: MessageKey, params?: TranslateParams): string;
}

interface LocaleContextValue {
  locale: Accessor<Locale>;
  setLocale: (value: Locale) => void;
  t: Translate;
}

const LocaleContext = createContext<LocaleContextValue>();

/** 国际化上下文；store 只负责读写，语言状态与翻译在这里处理。 */
export function LocaleProvider(props: ParentProps) {
  const [locale, setLocaleSignal] = createSignal<Locale>(readLocale());

  const setLocale = (value: Locale) => {
    setLocaleSignal(value);
    saveLocale(value);
  };

  const translate: Translate = (
    key: MessageKey,
    fallbackOrParams?: string | TranslateParams,
    params: TranslateParams = {},
  ): string => {
    const fallback = typeof fallbackOrParams === "string" ? fallbackOrParams : undefined;
    const values = typeof fallbackOrParams === "object" ? fallbackOrParams : params;
    const template = DICTIONARIES[locale()]?.[key] ?? fallback ?? key;
    return template.replace(/\{([^}]+)\}/g, (_, name: string) =>
      String(values[name] ?? `{${name}}`));
  };

  return (
    <LocaleContext value={{locale, setLocale, t: translate}}>
      {props.children}
    </LocaleContext>
  );
}

/** 读取国际化上下文，必须在 LocaleProvider 内使用。 */
export function useLocaleContext(): LocaleContextValue {
  return useContext(LocaleContext);
}
