import { For, Show, createSignal, type Component, type JSX } from "solid-js";

import { PlusIcon } from "../icon";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import type { SettingsServerOptions, SettingsValues } from "./types";

export interface SettingsServerSectionProps extends SettingsServerOptions {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  class?: string;
}


function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** 设置面板右侧的「服务器」内容：已配置列表 + 右上角添加弹窗。 */
export const SettingsServerSection: Component<SettingsServerSectionProps> = (props) => {
  const [addOpen, setAddOpen] = createSignal(false);
  const [name, setName] = createSignal(props.initialValue?.name ?? "");
  const [serverUrl, setServerUrl] = createSignal(props.initialValue?.serverUrl ?? "");
  const [token, setToken] = createSignal(props.initialValue?.token ?? "");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");

  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const openAdd = () => {
    setName(props.initialValue?.name ?? "");
    setServerUrl(props.initialValue?.serverUrl ?? "");
    setToken(props.initialValue?.token ?? "");
    setError("");
    setAddOpen(true);
  };

  const closeAdd = () => {
    if (saving()) return;
    setAddOpen(false);
    setError("");
  };

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    if (saving() || !props.onAdd) return;

    const values: SettingsValues = {
      name: name().trim(),
      serverUrl: serverUrl().trim(),
      token: token(),
    };

    if (!values.name) {
      setError(translate(locale(), "settings.errors.nameRequired", "请输入服务名称"));
      return;
    }
    if (!values.serverUrl) {
      setError(translate(locale(), "settings.errors.serverUrlRequired", "请输入服务器地址"));
      return;
    }
    if (!isHttpUrl(values.serverUrl)) {
      setError(translate(locale(), "settings.errors.serverUrlInvalid",
        "服务器地址必须是 http/https URL"));
      return;
    }
    if (!values.token) {
      setError(translate(locale(), "settings.errors.tokenRequired", "请输入 Token"));
      return;
    }

    setError("");
    setSaving(true);

    void props.onAdd(values)
      .then(() => setAddOpen(false))
      .catch((cause: unknown) => {
        setError(cause instanceof Error && cause.message
          ? cause.message
          : translate(locale(), "settings.errors.fallback", "保存失败，请稍后再试"));
      })
      .finally(() => setSaving(false));
  };

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100";

  return (
    <>
      <div class={`grid gap-4 ${props.class ?? ""}`}>
        <header class="flex items-start justify-between gap-3">
          <div class="grid gap-1">
            <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
              {translate(locale(), "settings.server.title", "服务器")}
            </h2>
            <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
              {translate(locale(), "settings.server.description", "管理本地网关连接与服务器配置")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAdd()}
            class="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-sky-600 outline-none transition hover:bg-sky-500/10 hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-500/15 dark:hover:text-sky-200"
          >
            <PlusIcon />
            {translate(locale(), "settings.server.add", "添加")}
          </button>
        </header>

        <div class="grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <h3 class="m-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {translate(locale(), "settings.server.configuredTitle", "已配置的服务器")}
          </h3>
          <For
            each={props.servers ?? []}
            fallback={
              <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
                {translate(locale(), "settings.server.empty", "尚未配置服务器")}
              </p>
            }
          >
            {(server) => (
              <div class="group flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 transition hover:bg-slate-900/5 dark:border-white/10 dark:hover:bg-white/5">
                <button
                  type="button"
                  onClick={() => props.onSelectServer?.(server.serverUrl)}
                  class="flex min-w-0 flex-1 items-center rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                >
                  <span class="grid min-w-0 flex-1">
                    <span class="truncate text-sm text-slate-700 dark:text-slate-200">
                      {server.name?.trim() || server.serverUrl}
                    </span>
                    <Show when={server.name?.trim()}>
                      <span class="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {server.serverUrl}
                      </span>
                    </Show>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => props.onTestServer?.(server)}
                  class="pointer-events-none shrink-0 rounded-md px-2 py-1 text-[12px] text-slate-600 opacity-0 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
                >
                  {translate(locale(), "settings.server.test", "测试连接")}
                </button>
              </div>
            )}
          </For>
        </div>
      </div>

      <Show when={addOpen()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="presentation"
          onClick={() => closeAdd()}
        >
          <form
            class="grid w-full max-w-sm gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label={translate(locale(), "settings.server.addTitle", "添加服务器")}
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSubmit}
            aria-busy={saving()}
          >
            <header class="grid gap-1">
              <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
                {translate(locale(), "settings.server.addTitle", "添加服务器")}
              </h2>
            </header>

            <label class="grid gap-2">
              <span class="text-[13px] text-slate-600 dark:text-slate-300">
                {translate(locale(), "settings.server.name", "服务名称")}
              </span>
              <input
                class={inputClass}
                name="name"
                type="text"
                autocomplete="off"
                spellcheck={false}
                placeholder={translate(locale(), "settings.server.namePlaceholder", "例如：本地开发")}
                required
                disabled={saving()}
                value={name()}
                onInput={(event) => setName(event.currentTarget.value)}
              />
            </label>

            <label class="grid gap-2">
              <span class="text-[13px] text-slate-600 dark:text-slate-300">
                {translate(locale(), "settings.server.serverUrl", "服务器地址")}
              </span>
              <input
                class={inputClass}
                name="serverUrl"
                type="url"
                inputmode="url"
                autocomplete="url"
                spellcheck={false}
                placeholder={translate(locale(), "settings.server.serverUrlPlaceholder",
                  "http://127.0.0.1:9528")}
                required
                disabled={saving()}
                value={serverUrl()}
                onInput={(event) => setServerUrl(event.currentTarget.value)}
              />
            </label>

            <label class="grid gap-2">
              <span class="text-[13px] text-slate-600 dark:text-slate-300">
                {translate(locale(), "settings.server.token", "Security Token")}
              </span>
              <input
                class={inputClass}
                name="token"
                type="password"
                autocomplete="off"
                spellcheck={false}
                placeholder={translate(locale(), "settings.server.tokenPlaceholder",
                  "粘贴访问 Token")}
                required
                disabled={saving()}
                value={token()}
                onInput={(event) => setToken(event.currentTarget.value)}
              />
            </label>

            <Show when={error()}>
              <p
                class="m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400"
                role="alert"
                aria-live="assertive"
              >
                {error()}
              </p>
            </Show>

            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeAdd()}
                disabled={saving()}
                class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                {translate(locale(), "settings.provider.cancel", "取消")}
              </button>
              <button
                type="submit"
                disabled={saving()}
                class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
              >
                {saving()
                  ? translate(locale(), "settings.server.adding", "添加中…")
                  : translate(locale(), "settings.server.add", "添加")}
              </button>
            </div>
          </form>
        </div>
      </Show>
    </>
  );
};
