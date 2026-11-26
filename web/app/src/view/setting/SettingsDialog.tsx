import { Show, createSignal, onCleanup } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";
import { Tabs } from "@kobalte/core/tabs";

import { useLocaleContext } from "../../context/LocaleContext";
import { AppearanceSettings } from "./AppearanceSettings";
import { ClientSettings } from "./ClientSettings";
import { LanguageSettings } from "./LanguageSettings";
import { SupplierSettings } from "./SupplierSettings";

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tabTriggerClass =
  "shrink-0 rounded-md px-3 py-2 text-left text-[13px] font-medium text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 data-[selected]:bg-indigo-50 data-[selected]:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:data-[selected]:bg-indigo-500/10 dark:data-[selected]:text-indigo-300";

/** 应用设置面板：垂直 Tabs，左侧菜单，右侧内容。 */
export function SettingsDialog(props: SettingsDialogProps) {
  const {t} = useLocaleContext();
  const [section, setSection] = createSignal("appearance");
  const [switching, setSwitching] = createSignal(false);
  let switchTimer: number | undefined;

  const changeSection = (value: string) => {
    if (value === section()) return;
    setSection(value);
    setSwitching(true);
    window.clearTimeout(switchTimer);
    switchTimer = window.setTimeout(() => setSwitching(false), 220);
  };

  onCleanup(() => window.clearTimeout(switchTimer));

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content class="fixed left-1/2 top-1/2 z-[60] flex h-[600px] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
          <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <Dialog.Title class="m-0 text-base font-semibold">
              {t("settings.title", "设置")}
            </Dialog.Title>
            <Dialog.CloseButton
              aria-label={t("settings.close", "关闭设置")}
              title={t("settings.close", "关闭设置")}
              class="grid h-8 w-8 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ✕
            </Dialog.CloseButton>
          </header>

          <Tabs
            value={section()}
            onChange={changeSection}
            orientation="vertical"
            class="flex min-h-0 flex-1 flex-col sm:flex-row"
          >
            <Tabs.List
              aria-label={t("settings.title", "设置")}
              class="flex w-full shrink-0 flex-col gap-1 overflow-auto border-b border-slate-200 bg-slate-50 p-2 sm:w-40 sm:border-b-0 sm:border-r dark:border-slate-800 dark:bg-slate-950/40"
            >
              <Tabs.Trigger value="appearance" class={tabTriggerClass}>
                {t("settings.appearance", "外观")}
              </Tabs.Trigger>
              <Tabs.Trigger value="language" class={tabTriggerClass}>
                {t("settings.language", "语言")}
              </Tabs.Trigger>
              <Tabs.Trigger value="client" class={tabTriggerClass}>
                {t("settings.client", "客户端")}
              </Tabs.Trigger>
              <Tabs.Trigger value="supplier" class={tabTriggerClass}>
                {t("settings.supplier", "供应商")}
              </Tabs.Trigger>
            </Tabs.List>

            <div class="relative min-h-0 flex-1 overflow-hidden" aria-busy={switching() ? "true" : "false"}>
              <Show when={switching()}>
                <div class="absolute inset-0 z-10 grid place-items-center bg-white/60 backdrop-blur-[1px] dark:bg-slate-900/60">
                  <span class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
                </div>
              </Show>
              <Tabs.Content value="appearance" class="h-full min-h-0 overflow-auto p-5 outline-none">
                <AppearanceSettings />
              </Tabs.Content>
              <Tabs.Content value="language" class="h-full min-h-0 overflow-auto p-5 outline-none">
                <LanguageSettings />
              </Tabs.Content>
              <Tabs.Content value="client" class="h-full min-h-0 overflow-auto p-5 outline-none">
                <ClientSettings />
              </Tabs.Content>
              <Tabs.Content value="supplier" class="h-full min-h-0 overflow-auto p-5 outline-none">
                <SupplierSettings />
              </Tabs.Content>
            </div>
          </Tabs>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
