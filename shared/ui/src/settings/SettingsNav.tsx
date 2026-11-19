import { For, type Component } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import type { SettingsSectionKey } from "./types";

export interface SettingsNavProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 当前选中的分组。 */
  active: SettingsSectionKey;
  /** 切换分组时回调。 */
  onSelect?: (key: SettingsSectionKey) => void;
  class?: string;
}

/** 设置面板左侧分组导航。 */
export const SettingsNav: Component<SettingsNavProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const sections = (): Array<{ key: SettingsSectionKey; label: string }> => [
    { key: "server", label: translate(locale(), "settings.server.title", "服务器") },
    { key: "provider", label: translate(locale(), "settings.provider.title", "供应商") },
    { key: "model", label: translate(locale(), "settings.model.title", "模型") },
    { key: "account", label: translate(locale(), "settings.account.title", "账号") },
  ];

  return (
    <nav
      aria-label={translate(locale(), "settings.title", "设置")}
      class={`flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm dark:border-white/10 dark:bg-slate-900/80 ${props.class ?? ""}`}
    >
      <For each={sections()}>
        {(section) => (
          <button
            type="button"
            onClick={() => props.onSelect?.(section.key)}
            aria-current={props.active === section.key ? "page" : undefined}
            class={`flex h-9 w-full items-center rounded-lg px-3 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
              props.active === section.key
                ? "bg-blue-500/15 font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                : "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/5"
            }`}
          >
            <span class="truncate">{section.label}</span>
          </button>
        )}
      </For>
    </nav>
  );
};
