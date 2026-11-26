import { Show } from "solid-js";

import { createEventListener } from "@solid-primitives/event-listener";
import { Dialog } from "@kobalte/core/dialog";

import { GlobeIcon } from "../../assets/icons/GlobeIcon";
import { LogoutIcon } from "../../assets/icons/LogoutIcon";
import { ServerIcon } from "../../assets/icons/ServerIcon";
import { SettingsIcon } from "../../assets/icons/SettingsIcon";
import { ThemeIcon } from "../../assets/icons/ThemeIcon";
import { useGlobalContext } from "../../context/GlobalContext";
import { useLayoutContext } from "../../context/LayoutContext";
import { useLocaleContext } from "../../context/LocaleContext";
import { useServerContext } from "../../context/ServerContext";
import { useSideNavContext } from "../../context/SideNavContext";

/** 左侧导航：客户端信息、语言、主题、用户与设置入口。 */
export function SideNav() {
  const {layout} = useLayoutContext();
  const {resolvedTheme, toggleTheme} = useGlobalContext();
  const {locale, setLocale, t} = useLocaleContext();
  const {serverUrl, securityToken, connected, setDialogOpen, disconnectServer} = useServerContext();
  const {
    left,
    localeOpen,
    setLocaleOpen,
    serverOpen,
    setServerOpen,
    exitConfirm,
    setExitConfirm,
    setSettingsOpen,
  } = useSideNavContext();
  let localeMenu: HTMLDivElement | undefined;
  let serverMenu: HTMLDivElement | undefined;

  createEventListener(window, "pointerdown", (event) => {
    if (!localeMenu?.contains(event.target as Node)) setLocaleOpen(false);
    if (!serverMenu?.contains(event.target as Node)) setServerOpen(false);
  });

  const leftWidth = () => layout().leftWidth;
  const leftOpen = () => layout().leftOpen;

  return (
    <>
      <aside
        aria-label="左侧导航"
        aria-hidden={leftOpen() ? "false" : "true"}
        style={{
          width: leftOpen() ? `${leftWidth()}px` : "0px",
          "min-width": leftOpen() ? "200px" : "0px",
        }}
        class={`${leftOpen() ? "max-lg:hidden lg:flex opacity-100" : "flex opacity-0 pointer-events-none"} shrink-0 flex-col overflow-hidden rounded-xl bg-white/70 shadow-sm transition-[width,min-width,opacity] duration-200 ease-out dark:bg-slate-900/60`}
      >
        <header class="flex h-14 min-w-[200px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 shadow-sm dark:border-slate-800">
          <div ref={serverMenu} class="relative shrink-0">
            <button
              type="button"
              onClick={() => setServerOpen((open) => !open)}
              aria-label={t("server.label", "客户端")}
              aria-haspopup="dialog"
              aria-expanded={serverOpen() ? "true" : "false"}
              title={t("server.label", "客户端")}
              class="grid h-7 w-7 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <ServerIcon class="h-4 w-4" />
            </button>

            <Show when={serverOpen()}>
              <div class="absolute left-0 top-full z-50 mt-1 grid w-44 gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5">
                    <span
                      class={`h-1.5 w-1.5 rounded-full ${connected() ? "bg-emerald-500" : "bg-slate-400"}`}
                      aria-hidden="true"
                    />
                    <span class="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                      {connected()
                        ? t("server.connected", "已连接")
                        : t("server.disconnected", "未连接")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setServerOpen(false);
                      setExitConfirm(true);
                    }}
                    aria-label={t("server.exit", "退出当前客户端")}
                    title={t("server.exit", "退出当前客户端")}
                    class="grid h-6 w-6 place-items-center rounded text-slate-400 outline-none transition hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    <LogoutIcon class="h-3.5 w-3.5" />
                  </button>
                </div>

                <div class="grid gap-0.5">
                  <span class="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t("server.address", "客户端地址")}
                  </span>
                  <span
                    class="truncate text-[11px] text-slate-600 dark:text-slate-300"
                    title={serverUrl()}
                  >
                    {serverUrl()}
                  </span>
                </div>

                <div class="flex items-center justify-between gap-2 text-[11px]">
                  <span class="text-slate-400 dark:text-slate-500">
                    {t("server.token", "访问令牌")}
                  </span>
                  <span class="text-slate-600 dark:text-slate-300">
                    {securityToken()
                      ? t("server.tokenConfigured", "已配置")
                      : t("server.tokenMissing", "未配置")}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setServerOpen(false);
                    setDialogOpen(true);
                  }}
                  class="rounded-md bg-indigo-500 px-2 py-1.5 text-[11px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                >
                  {t("server.configure", "配置客户端")}
                </button>
              </div>
            </Show>
          </div>

          <div class="flex shrink-0 items-center gap-0.5">
            <div ref={localeMenu} class="relative">
              <button
                type="button"
                onClick={() => setLocaleOpen((open) => !open)}
                aria-label={t("locale.label", "切换语言")}
                aria-haspopup="listbox"
                aria-expanded={localeOpen() ? "true" : "false"}
                title={t("locale.label", "切换语言")}
                class="flex h-7 items-center gap-0.5 rounded-md px-1.5 text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <GlobeIcon class="h-4 w-4" />
              </button>
              <Show when={localeOpen()}>
                <div
                  role="listbox"
                  aria-label={t("locale.label", "切换语言")}
                  class="absolute left-1/2 top-full z-50 mt-1 grid w-28 -translate-x-1/2 gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={locale() === "zh-CN" ? "true" : "false"}
                    onClick={() => {
                      setLocale("zh-CN");
                      setLocaleOpen(false);
                    }}
                    class="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] text-slate-600 outline-none transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <span>{t("locale.zh", "简体中文")}</span>
                    <Show when={locale() === "zh-CN"}>
                      <span class="text-indigo-500" aria-hidden="true">✓</span>
                    </Show>
                  </button>
                  <button
                    type="button"
                    role="option"
                    aria-selected={locale() === "en-US" ? "true" : "false"}
                    onClick={() => {
                      setLocale("en-US");
                      setLocaleOpen(false);
                    }}
                    class="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] text-slate-600 outline-none transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <span>{t("locale.en", "English")}</span>
                    <Show when={locale() === "en-US"}>
                      <span class="text-indigo-500" aria-hidden="true">✓</span>
                    </Show>
                  </button>
                </div>
              </Show>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={resolvedTheme() === "dark"
                ? t("home.toggleLight", "切换浅色")
                : t("home.toggleDark", "切换深色")}
              title={resolvedTheme() === "dark"
                ? t("home.toggleLight", "切换浅色")
                : t("home.toggleDark", "切换深色")}
              class="grid h-7 w-7 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <ThemeIcon dark={resolvedTheme() === "dark"} class="h-4 w-4" />
            </button>
          </div>
        </header>
        <div class="flex min-h-0 min-w-[200px] flex-1 flex-col gap-4 overflow-auto p-4">
          {left()}
        </div>

        <footer class="flex min-w-[200px] shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 dark:border-slate-800">
          <div class="flex min-w-0 items-center gap-2">
            <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-500 text-[11px] font-semibold text-white">
              U
            </span>
            <div class="grid min-w-0 gap-0.5">
              <span class="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
                {t("user.local", "本地用户")}
              </span>
              <span class="truncate text-[10px] text-slate-400 dark:text-slate-500">
                {t("user.localDescription", "本地账户")}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t("settings.open", "设置")}
            title={t("settings.open", "设置")}
            class="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <SettingsIcon class="h-4 w-4" />
          </button>
        </footer>
      </aside>


      <Dialog
        open={exitConfirm()}
        onOpenChange={setExitConfirm}
        modal
      >
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm" />
          <Dialog.Content class="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
            <Dialog.Title class="m-0 text-base font-semibold">
              {t("server.exitTitle", "退出当前客户端？")}
            </Dialog.Title>
            <Dialog.Description class="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              {t("server.exitDescription", "退出后将清除当前客户端配置，并打开客户端配置弹窗。")}
            </Dialog.Description>
            <div class="mt-4 flex justify-end gap-2">
              <Dialog.CloseButton class="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                {t("server.cancel", "取消")}
              </Dialog.CloseButton>
              <button
                type="button"
                onClick={() => {
                  disconnectServer();
                  setExitConfirm(false);
                }}
                class="rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white outline-none transition hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-500/40"
              >
                {t("server.exitConfirm", "退出")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
