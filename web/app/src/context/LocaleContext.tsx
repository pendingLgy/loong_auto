import {type Accessor, createSignal,} from "solid-js";

import {enUS, type MessageKey, type Messages} from "../runtime/i18n/en-US";
import {type Locale, readLocale, saveLocale} from "../store/locale";
import {createSimpleContext} from "./ContextHelper";

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


const localeCtx = createSimpleContext<LocaleContextValue>({
  name: "LocaleContext",
  gate: true,
  init: () => {
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
    return {
      locale, setLocale, t: translate
    }
  }
})

export const useLocaleContext = localeCtx.use
export const LocaleProvider = localeCtx.provider

