import { Show, type Component } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import type { SettingsAccountOptions } from "./types";

export interface SettingsAccountSectionProps extends SettingsAccountOptions {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  class?: string;
}

/** 设置面板右侧的「账号」内容。 */
export const SettingsAccountSection: Component<SettingsAccountSectionProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;

  return (
    <div class={`grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80 ${props.class ?? ""}`}>
      <h2 class="m-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {translate(locale(), "settings.account.title", "账号")}
      </h2>
      <div class="grid gap-1">
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
          {props.userName?.trim() || translate(locale(), "settings.account.anonymous", "未登录")}
        </span>
        <Show when={props.username?.trim()}>
          <span class="text-xs text-slate-500 dark:text-slate-400">
            {props.username}
          </span>
        </Show>
      </div>
      <div class="flex items-center justify-end">
        <button
          type="button"
          onClick={() => props.onLogout?.()}
          class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
        >
          {translate(locale(), "settings.account.logout", "退出登录")}
        </button>
      </div>
    </div>
  );
};
