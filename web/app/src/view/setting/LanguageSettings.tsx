import { useLocaleContext } from "../../context/LocaleContext";
import { optionClass } from "./classes";

/** 语言设置。 */
export function LanguageSettings() {
  const {locale, setLocale, t} = useLocaleContext();

  return (
    <section class="grid gap-3">
      <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
        {t("settings.languageDescription", "选择界面语言。")}
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setLocale("zh-CN")}
          aria-pressed={locale() === "zh-CN" ? "true" : "false"}
          class={optionClass(locale() === "zh-CN")}
        >
          {t("locale.zh", "简体中文")}
        </button>
        <button
          type="button"
          onClick={() => setLocale("en-US")}
          aria-pressed={locale() === "en-US" ? "true" : "false"}
          class={optionClass(locale() === "en-US")}
        >
          {t("locale.en", "English")}
        </button>
      </div>
    </section>
  );
}
