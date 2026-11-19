import { For, Show, createSignal, type Component, type JSX } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import type {
  ConfiguredModelProvider,
  ModelProviderValues,
  PopularProvider,
  SettingsProviderOptions,
} from "./types";

export interface SettingsProviderSectionProps extends SettingsProviderOptions {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  class?: string;
}

function MoreDotsIcon(): JSX.Element {
  return (
    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function FlameIcon(): JSX.Element {
  return (
    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c.6 3.1 2.1 4.7 3.8 6.4C17.7 10.3 19 12 19 14.5A7 7 0 0 1 5 14.5c0-2 .8-3.6 2.2-5 .2 1.5.9 2.6 2 3.2-.4-3.6 1-6.6 2.8-10.7Z" />
    </svg>
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** 设置面板右侧的「模型供应商」内容：已配置列表 + 热门推荐 + 更多供应商。 */
export const SettingsProviderSection: Component<SettingsProviderSectionProps> = (props) => {
  const [dialogProvider, setDialogProvider] = createSignal<PopularProvider | null>(null);
  const [dialogAlias, setDialogAlias] = createSignal("");
  const [dialogBaseUrl, setDialogBaseUrl] = createSignal("");
  const [dialogApiKey, setDialogApiKey] = createSignal("");
  const [dialogSaving, setDialogSaving] = createSignal(false);
  const [dialogError, setDialogError] = createSignal("");
  const [showAll, setShowAll] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");

  const [menuProvider, setMenuProvider] = createSignal<ConfiguredModelProvider | null>(null);
  const [renameTarget, setRenameTarget] = createSignal<ConfiguredModelProvider | null>(null);
  const [renameAlias, setRenameAlias] = createSignal("");
  const [renameSaving, setRenameSaving] = createSignal(false);
  const [renameError, setRenameError] = createSignal("");
  const [editProvider, setEditProvider] = createSignal<ConfiguredModelProvider | null>(null);
  const [editApiKey, setEditApiKey] = createSignal("");
  const [editSaving, setEditSaving] = createSignal(false);
  const [editError, setEditError] = createSignal("");

  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const filteredProviders = (): PopularProvider[] => {
    const query = searchQuery().trim().toLowerCase();
    const providers = props.allProviders ?? [];
    if (!query) return providers;
    return providers.filter((provider) => provider.name.toLowerCase().includes(query));
  };

  const isPopularProvider = (provider: PopularProvider) =>
    (props.popular ?? []).some((item) => item.name === provider.name);

  const filteredEmpty = () => searchQuery().trim()
    ? translate(locale(), "settings.provider.noMatch", "没有匹配的供应商")
    : translate(locale(), "settings.provider.popularEmpty", "暂无热门供应商");

  const openConnect = (provider: PopularProvider) => {
    setDialogProvider(provider);
    setDialogAlias(provider.name);
    setDialogBaseUrl(provider.baseUrl);
    setDialogApiKey("");
    setDialogError("");
  };

  const closeConnect = () => {
    if (dialogSaving()) return;
    setDialogProvider(null);
    setDialogError("");
  };

  const openEdit = (provider: ConfiguredModelProvider) => {
    setEditProvider(provider);
    setEditApiKey("");
    setEditError("");
    props.onEditProvider?.(provider);
  };

  const closeEdit = () => {
    if (editSaving()) return;
    setEditProvider(null);
    setEditError("");
  };

  const openRename = (provider: ConfiguredModelProvider) => {
    setRenameTarget(provider);
    setRenameAlias(provider.alias?.trim() || provider.name);
    setRenameError("");
  };

  const closeRename = () => {
    if (renameSaving()) return;
    setRenameTarget(null);
    setRenameError("");
  };

  const handleRenameSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    const provider = renameTarget();
    if (!provider || renameSaving()) return;

    const alias = renameAlias().trim();
    if (!alias) {
      setRenameError(translate(locale(), "settings.errors.providerAliasRequired", "请输入别称"));
      return;
    }

    setRenameError("");
    setRenameSaving(true);

    void Promise.resolve(props.onRenameProvider?.(provider, alias))
      .then(() => setRenameTarget(null))
      .catch((cause: unknown) => {
        setRenameError(cause instanceof Error && cause.message
          ? cause.message
          : translate(locale(), "settings.errors.fallback", "保存失败，请稍后再试"));
      })
      .finally(() => setRenameSaving(false));
  };

  const handleEditSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    const provider = editProvider();
    if (!provider || editSaving()) return;

    if (!editApiKey()) {
      setEditError(translate(locale(), "settings.errors.providerApiKeyRequired", "请输入 API Key"));
      return;
    }

    setEditError("");
    setEditSaving(true);

    void Promise.resolve(props.onUpdateApiKey?.(provider, editApiKey()))
      .then(() => setEditProvider(null))
      .catch((cause: unknown) => {
        setEditError(cause instanceof Error && cause.message
          ? cause.message
          : translate(locale(), "settings.errors.fallback", "保存失败，请稍后再试"));
      })
      .finally(() => setEditSaving(false));
  };

  const handleConnectSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    const provider = dialogProvider();
    if (!provider || dialogSaving() || !props.onAdd) return;

    const alias = dialogAlias().trim();
    const values: ModelProviderValues = {
      name: provider.name,
      alias: alias || provider.name,
      baseUrl: dialogBaseUrl().trim(),
      apiKey: dialogApiKey(),
      model: "",
    };

    if (!values.baseUrl) {
      setDialogError(translate(locale(), "settings.errors.providerBaseUrlRequired", "请输入接口地址"));
      return;
    }
    if (!isHttpUrl(values.baseUrl)) {
      setDialogError(translate(locale(), "settings.errors.providerBaseUrlInvalid",
        "接口地址必须是 http/https URL"));
      return;
    }
    if (!values.apiKey) {
      setDialogError(translate(locale(), "settings.errors.providerApiKeyRequired", "请输入 API Key"));
      return;
    }

    setDialogError("");
    setDialogSaving(true);

    void props.onAdd(values)
      .then(() => setDialogProvider(null))
      .catch((cause: unknown) => {
        setDialogError(cause instanceof Error && cause.message
          ? cause.message
          : translate(locale(), "settings.errors.fallback", "保存失败，请稍后再试"));
      })
      .finally(() => setDialogSaving(false));
  };

  const allProviderRow = (provider: PopularProvider, onConnect: () => void) => (
    <button
      type="button"
      onClick={onConnect}
      class="flex w-full items-center gap-2 rounded-lg border-slate-200 px-3 py-2 text-left outline-none transition hover:bg-slate-900/5 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-white/10 dark:hover:bg-white/5"
    >
      <span class="flex min-w-0 flex-1 items-center gap-1.5">
        <span class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {provider.name}
        </span>
        <Show when={isPopularProvider(provider)}>
          <span
            class="shrink-0 text-orange-500 dark:text-orange-400"
            title={translate(locale(), "settings.provider.hot", "热门")}
            aria-label={translate(locale(), "settings.provider.hot", "热门")}
          >
            <FlameIcon />
          </span>
        </Show>
      </span>
    </button>
  );

  const providerRow = (provider: PopularProvider, onConnect: () => void) => (
    <div class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 transition hover:bg-slate-900/5 dark:border-white/10 dark:hover:bg-white/5">
      <span class="grid min-w-0 flex-1 gap-0.5">
        <span class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {provider.name}
        </span>
        <span class="truncate text-[12px] text-slate-500 dark:text-slate-400">
          {provider.description}
        </span>
        <span class="truncate text-[11px] text-slate-400 dark:text-slate-500">
          {provider.baseUrl}
        </span>
      </span>
      <button
        type="button"
        onClick={onConnect}
        class="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-[12px] text-slate-600 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
      >
        {translate(locale(), "settings.provider.connect", "连接")}
      </button>
    </div>
  );

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100";

  return (
    <>
      <Show when={menuProvider()}>
        <div
          class="fixed inset-0 z-10"
          aria-hidden="true"
          onClick={() => setMenuProvider(null)}
        />
      </Show>

      <div class={`grid gap-4 ${props.class ?? ""}`}>
        <header class="grid gap-1">
          <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
            {translate(locale(), "settings.provider.title", "供应商")}
          </h2>
          <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
            {translate(locale(), "settings.provider.description", "管理模型供应商与 API Key 配置")}
          </p>
        </header>

        <div class="grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <h2 class="m-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {translate(locale(), "settings.provider.configuredTitle", "已配置的供应商")}
          </h2>
          <For
            each={props.providers ?? []}
            fallback={
              <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
                {translate(locale(), "settings.provider.empty", "尚未配置模型供应商")}
              </p>
            }
          >
            {(provider) => (
              <div class="relative flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 transition hover:bg-slate-900/5 dark:border-white/10 dark:hover:bg-white/5">
                <span class="grid min-w-0 flex-1">
                  <span class="truncate text-sm text-slate-700 dark:text-slate-200">
                    {provider.alias?.trim() || provider.name}
                  </span>
                  <span class="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {provider.baseUrl}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => openEdit(provider)}
                  class="shrink-0 rounded-md px-2 py-1 text-[12px] text-slate-600 outline-none transition hover:bg-slate-900/10 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
                >
                  {translate(locale(), "settings.provider.edit", "编辑")}
                </button>
                <button
                  type="button"
                  onClick={() => setMenuProvider(menuProvider() === provider ? null : provider)}
                  aria-label={translate(locale(), "settings.provider.moreActions", "更多操作")}
                  aria-haspopup="menu"
                  aria-expanded={menuProvider() === provider}
                  class="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/10 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <MoreDotsIcon />
                </button>
                <Show when={menuProvider() === provider}>
                  <div
                    role="menu"
                    class="absolute right-0 top-full z-20 mt-1 grid w-28 gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuProvider(null);
                        openRename(provider);
                      }}
                      class="rounded-md px-2 py-1.5 text-left text-[12px] text-slate-700 outline-none transition hover:bg-slate-900/5 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      {translate(locale(), "settings.provider.rename", "重命名")}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuProvider(null);
                        props.onDeleteProvider?.(provider);
                      }}
                      class="rounded-md px-2 py-1.5 text-left text-[12px] text-red-600 outline-none transition hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-400 dark:hover:bg-red-500/15"
                    >
                      {translate(locale(), "settings.provider.remove", "移除")}
                    </button>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>

        <div class="grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <div class="flex items-center justify-between gap-2">
            <h2 class="m-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {translate(locale(), "settings.provider.popularTitle", "热门供应商")}
            </h2>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setShowAll(true);
              }}
              class="shrink-0 rounded-md px-2 py-1 text-[12px] text-sky-600 outline-none transition hover:bg-sky-500/10 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-500/15"
            >
              {translate(locale(), "settings.provider.more", "更多供应商")}
            </button>
          </div>
          <For
            each={props.popular ?? []}
            fallback={
              <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
                {translate(locale(), "settings.provider.popularEmpty", "暂无热门供应商")}
              </p>
            }
          >
            {(provider) => providerRow(provider, () => {
              props.onSelectPopular?.(provider);
              openConnect(provider);
            })}
          </For>
        </div>
      </div>

      <Show when={dialogProvider()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="presentation"
          onClick={() => closeConnect()}
        >
          <form
            class="grid w-full max-w-sm gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label={translate(locale(), "settings.provider.connectTitle", "连接供应商")}
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleConnectSubmit}
            aria-busy={dialogSaving()}
          >
            <header class="grid gap-1">
              <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
                {translate(locale(), "settings.provider.connectTitle", "连接供应商")}
              </h2>
              <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
                {dialogProvider()?.name} · {dialogProvider()?.description}
              </p>
            </header>

            <label class="grid gap-2">
              <span class="text-[13px] text-slate-600 dark:text-slate-300">
                {translate(locale(), "settings.provider.alias", "别称")}
              </span>
              <input
                class={inputClass}
                name="connectAlias"
                type="text"
                autocomplete="off"
                spellcheck={false}
                placeholder={translate(locale(), "settings.provider.aliasPlaceholder", "例如：我的 OpenAI")}
                disabled={dialogSaving()}
                value={dialogAlias()}
                onInput={(event) => setDialogAlias(event.currentTarget.value)}
              />
            </label>

            <label class="grid gap-2">
              <span class="text-[13px] text-slate-600 dark:text-slate-300">
                {translate(locale(), "settings.provider.baseUrl", "接口地址")}
              </span>
              <input
                class={inputClass}
                name="connectBaseUrl"
                type="url"
                inputmode="url"
                autocomplete="url"
                spellcheck={false}
                required
                disabled={dialogSaving()}
                value={dialogBaseUrl()}
                onInput={(event) => setDialogBaseUrl(event.currentTarget.value)}
              />
            </label>

            <label class="grid gap-2">
              <span class="text-[13px] text-slate-600 dark:text-slate-300">
                {translate(locale(), "settings.provider.apiKey", "API Key")}
              </span>
              <input
                class={inputClass}
                name="connectApiKey"
                type="password"
                autocomplete="off"
                spellcheck={false}
                placeholder={translate(locale(), "settings.provider.apiKeyPlaceholder", "粘贴 API Key")}
                required
                autofocus
                disabled={dialogSaving()}
                value={dialogApiKey()}
                onInput={(event) => setDialogApiKey(event.currentTarget.value)}
              />
            </label>

            <Show when={dialogError()}>
              <p
                class="m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400"
                role="alert"
                aria-live="assertive"
              >
                {dialogError()}
              </p>
            </Show>

            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConnect()}
                disabled={dialogSaving()}
                class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                {translate(locale(), "settings.provider.cancel", "取消")}
              </button>
              <button
                type="submit"
                disabled={dialogSaving()}
                class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
              >
                {dialogSaving()
                  ? translate(locale(), "settings.provider.connecting", "连接中…")
                  : translate(locale(), "settings.provider.connect", "连接")}
              </button>
            </div>
          </form>
        </div>
      </Show>

      <Show when={editProvider()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="presentation"
          onClick={() => closeEdit()}
        >
          <form
            class="grid w-full max-w-sm gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label={translate(locale(), "settings.provider.editTitle", "修改 API Key")}
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleEditSubmit}
            aria-busy={editSaving()}
          >
            <header class="grid gap-1">
              <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
                {translate(locale(), "settings.provider.editTitle", "修改 API Key")}
              </h2>
              <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
                {editProvider()?.alias?.trim() || editProvider()?.name} · {editProvider()?.baseUrl}
              </p>
            </header>

            <label class="grid gap-2">
              <span class="text-[13px] text-slate-600 dark:text-slate-300">
                {translate(locale(), "settings.provider.apiKey", "API Key")}
              </span>
              <input
                class={inputClass}
                name="editApiKey"
                type="password"
                autocomplete="off"
                spellcheck={false}
                placeholder={translate(locale(), "settings.provider.apiKeyPlaceholder", "粘贴 API Key")}
                required
                autofocus
                disabled={editSaving()}
                value={editApiKey()}
                onInput={(event) => setEditApiKey(event.currentTarget.value)}
              />
            </label>

            <Show when={editError()}>
              <p
                class="m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400"
                role="alert"
                aria-live="assertive"
              >
                {editError()}
              </p>
            </Show>

            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeEdit()}
                disabled={editSaving()}
                class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                {translate(locale(), "settings.provider.cancel", "取消")}
              </button>
              <button
                type="submit"
                disabled={editSaving()}
                class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
              >
                {editSaving()
                  ? translate(locale(), "settings.provider.saving", "保存中…")
                  : translate(locale(), "settings.provider.save", "保存")}
              </button>
            </div>
          </form>
        </div>
      </Show>

      <Show when={renameTarget()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="presentation"
          onClick={() => closeRename()}
        >
          <form
            class="grid w-full max-w-sm gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label={translate(locale(), "settings.provider.renameTitle", "重命名供应商")}
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleRenameSubmit}
            aria-busy={renameSaving()}
          >
            <header class="grid gap-1">
              <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
                {translate(locale(), "settings.provider.renameTitle", "重命名供应商")}
              </h2>
              <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
                {renameTarget()?.name} · {renameTarget()?.baseUrl}
              </p>
            </header>

            <label class="grid gap-2">
              <span class="text-[13px] text-slate-600 dark:text-slate-300">
                {translate(locale(), "settings.provider.alias", "别称")}
              </span>
              <input
                class={inputClass}
                name="renameAlias"
                type="text"
                autocomplete="off"
                spellcheck={false}
                placeholder={translate(locale(), "settings.provider.aliasPlaceholder", "例如：我的 OpenAI")}
                required
                autofocus
                disabled={renameSaving()}
                value={renameAlias()}
                onInput={(event) => setRenameAlias(event.currentTarget.value)}
              />
            </label>

            <Show when={renameError()}>
              <p
                class="m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400"
                role="alert"
                aria-live="assertive"
              >
                {renameError()}
              </p>
            </Show>

            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeRename()}
                disabled={renameSaving()}
                class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                {translate(locale(), "settings.provider.cancel", "取消")}
              </button>
              <button
                type="submit"
                disabled={renameSaving()}
                class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
              >
                {renameSaving()
                  ? translate(locale(), "settings.provider.saving", "保存中…")
                  : translate(locale(), "settings.provider.save", "保存")}
              </button>
            </div>
          </form>
        </div>
      </Show>

      <Show when={showAll()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="presentation"
          onClick={() => setShowAll(false)}
        >
          <div
            class="grid w-full max-w-lg gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label={translate(locale(), "settings.provider.allTitle", "全部供应商")}
            onClick={(event) => event.stopPropagation()}
          >
            <header class="flex items-center justify-between gap-2">
              <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
                {translate(locale(), "settings.provider.allTitle", "全部供应商")}
              </h2>
              <button
                type="button"
                onClick={() => setShowAll(false)}
                aria-label={translate(locale(), "settings.provider.close", "关闭")}
                title={translate(locale(), "settings.provider.close", "关闭")}
                class="grid h-7 w-7 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </header>

            <label class="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 text-slate-400 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/30 dark:border-white/15 dark:bg-slate-950/60">
              <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                class="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                type="search"
                autocomplete="off"
                spellcheck={false}
                placeholder={translate(locale(), "settings.provider.searchPlaceholder", "搜索供应商名称")}
                value={searchQuery()}
                onInput={(event) => setSearchQuery(event.currentTarget.value)}
              />
            </label>

            <div class="grid h-80 auto-rows-min gap-2 overflow-y-auto pr-1">
              <For
                each={filteredProviders()}
                fallback={
                  <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
                    {filteredEmpty()}
                  </p>
                }
              >
                {(provider) => allProviderRow(provider, () => {
                  setShowAll(false);
                  props.onSelectAllProvider?.(provider);
                  openConnect(provider);
                })}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};
