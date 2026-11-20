import { Show, createSignal, type Component } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import { SettingsAccountSection } from "./SettingsAccountSection";
import { SettingsNav } from "./SettingsNav";
import { SettingsModelSection } from "./SettingsModelSection";
import { SettingsProviderSection } from "./SettingsProviderSection";
import { SettingsServerSection } from "./SettingsServerSection";
import type {
  SettingsAccountOptions,
  SettingsModelOptions,
  SettingsProviderOptions,
  SettingsSectionKey,
  SettingsServerOptions,
} from "./types";

export interface SettingsPageProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 默认选中的设置分组，默认「服务器连接」。 */
  defaultSection?: SettingsSectionKey;
  /** 点击右上角返回按钮。 */
  onBack?: () => void;
  /** 切换设置分组时回调。 */
  onSectionChange?: (key: SettingsSectionKey) => void;
  /** 服务器连接页面专属配置。 */
  server?: SettingsServerOptions;
  /** 模型供应商页面专属配置。 */
  provider?: SettingsProviderOptions;
  /** 模型页面专属配置。 */
  model?: SettingsModelOptions;
  /** 账号页面专属配置。 */
  account?: SettingsAccountOptions;
  class?: string;
}

/**
 * 设置面板：`SettingsNav` 负责左侧分组导航，右侧按分组渲染
 * `SettingsServerSection` / `SettingsAccountSection`。
 *
 * props 按页面分组：服务器相关配置放 `server`，账号相关放 `account`。
 */
export const SettingsPage: Component<SettingsPageProps> = (props) => {
  const [activeSection, setActiveSection] = createSignal<SettingsSectionKey>(
    props.defaultSection ?? "server",
  );

  const selectSection = (key: SettingsSectionKey) => {
    setActiveSection(key);
    props.onSectionChange?.(key);
  };

  return (
    <section class={`grid gap-4 ${props.class ?? ""}`}>
      <header class="flex items-start justify-between gap-3">
        <div class="grid min-w-0 gap-1">
          <h1 class="m-0 text-xl font-semibold tracking-tight">
            {translate(props.locale ?? DEFAULT_LOCALE, "settings.title", "设置")}
          </h1>
          <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
            {translate(props.locale ?? DEFAULT_LOCALE, "settings.description", "管理服务器连接与账号信息")}
          </p>
        </div>
        <Show when={props.onBack}>
          <button
            type="button"
            onClick={() => props.onBack?.()}
            class="shrink-0 rounded-md px-2.5 py-1.5 text-sm text-slate-600 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
          >
            {translate(props.locale ?? DEFAULT_LOCALE, "settings.back", "返回")}
          </button>
        </Show>
      </header>

      <div class="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
        <SettingsNav
          locale={props.locale}
          active={activeSection()}
          onSelect={selectSection}
        />

        <div class="grid min-w-0 gap-4">
          <Show when={activeSection() === "server"}>
            <SettingsServerSection locale={props.locale} {...props.server} />
          </Show>

          <Show when={activeSection() === "provider"}>
            <SettingsProviderSection locale={props.locale} {...props.provider} />
          </Show>

          <Show when={activeSection() === "model"}>
            <SettingsModelSection locale={props.locale} {...props.model} />
          </Show>

          <Show when={activeSection() === "account"}>
            <SettingsAccountSection locale={props.locale} {...props.account} />
          </Show>
        </div>
      </div>
    </section>
  );
};
