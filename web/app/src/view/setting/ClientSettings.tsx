import { useLocaleContext } from "../../context/LocaleContext";
import { useServerContext } from "../../context/ServerContext";

/** 客户端信息设置。 */
export function ClientSettings() {
  const {serverUrl} = useServerContext();
  const {t} = useLocaleContext();

  return (
    <section class="grid gap-3">
      <div class="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <span class="text-[11px] text-slate-400 dark:text-slate-500">
          {t("settings.currentClient", "当前客户端")}
        </span>
        <span
          class="truncate text-[12px] text-slate-600 dark:text-slate-300"
          title={serverUrl()}
        >
          {serverUrl()}
        </span>
      </div>
    </section>
  );
}
