import { useGlobalContext } from "../../context/GlobalContext";
import { useLocaleContext } from "../../context/LocaleContext";
import { optionClass } from "./classes";

/** 外观设置。 */
export function AppearanceSettings() {
  const {resolvedTheme, setTheme} = useGlobalContext();
  const {t} = useLocaleContext();

  return (
    <section class="grid gap-3">
      <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
        {t("settings.appearanceDescription", "选择界面主题。")}
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTheme("light")}
          aria-pressed={resolvedTheme() === "light" ? "true" : "false"}
          class={optionClass(resolvedTheme() === "light")}
        >
          {t("theme.light", "浅色")}
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          aria-pressed={resolvedTheme() === "dark" ? "true" : "false"}
          class={optionClass(resolvedTheme() === "dark")}
        >
          {t("theme.dark", "深色")}
        </button>
      </div>
    </section>
  );
}
