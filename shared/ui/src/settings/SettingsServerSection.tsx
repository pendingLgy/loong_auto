import { Show, type Component } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import type { SettingsServerOptions } from "./types";

export interface SettingsServerSectionProps extends SettingsServerOptions {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  class?: string;
}

/**
 * 设置面板右侧的「服务器」内容：展示单条服务器配置，支持选择与测试连接。
 */
export const SettingsServerSection: Component<SettingsServerSectionProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;
  const server = () => props.server;

  return (
    <div class={`grid gap-4 ${props.class ?? ""}`}>
      <header class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
          {translate(locale(), "settings.server.title", "服务器")}
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          {translate(locale(), "settings.server.description", "管理本地网关连接与服务器配置")}
        </p>
      </header>

      <Show
        when={server()}
        fallback={
          <p class="m-0 rounded-2xl border border-slate-200 bg-white/90 p-5 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-400">
            {translate(locale(), "settings.server.empty", "尚未配置服务器")}
          </p>
        }
      >
        {(entry) => (
          <div class="group flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
            <button
              type="button"
              onClick={() => props.onSelectServer?.(entry().serverUrl)}
              class="flex min-w-0 flex-1 items-center rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
            >
              <span class="grid min-w-0 flex-1">
                <span class="truncate text-sm text-slate-700 dark:text-slate-200">
                  {entry().name?.trim() || entry().serverUrl}
                </span>
                <Show when={entry().name?.trim()}>
                  <span class="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {entry().serverUrl}
                  </span>
                </Show>
              </span>
            </button>
            <button
              type="button"
              onClick={() => props.onTestServer?.(entry())}
              class="pointer-events-none shrink-0 rounded-md px-2 py-1 text-[12px] text-slate-600 opacity-0 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
            >
              {translate(locale(), "settings.server.test", "测试连接")}
            </button>
          </div>
        )}
      </Show>
    </div>
  );
};
