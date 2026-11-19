import { For, Show, createEffect, createSignal, type Component, type JSX } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

/** 可选的模型。 */
export interface ModelOption {
  id: string;
  /** 展示名称；为空时使用 id。 */
  modelName?: string;
  /** 是否已启用；为 false 时置灰且不可选择。 */
  enabled?: boolean;
}

/** 可选的模型，按供应商分组。 */
export interface ModelGroup {
  providerName: string;
  providerAlias?: string;
  models: ModelOption[];
}

/** 可添加的供应商。 */
export interface ProviderOption {
  name: string;
  description?: string;
  baseUrl: string;
}

/** 连接供应商表单值。 */
export interface ConnectValues {
  alias: string;
  baseUrl: string;
  apiKey: string;
}

/** 已配置供应商的模型（含启用状态）。 */
export interface ManagedModel {
  id: string;
  /** 展示名称；为空时使用 id。 */
  modelName?: string;
  enabled?: boolean;
}

/** 已配置供应商及其模型。 */
export interface ManagedProvider {
  providerName: string;
  providerAlias?: string;
  baseUrl?: string;
  models: ManagedModel[];
}

export interface ModelPickerProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 是否显示弹窗。 */
  open: boolean;
  /** 可选的模型，按供应商分组。 */
  groups?: ModelGroup[];
  /** 当前选中的模型标识，用于高亮。 */
  activeModel?: string;
  /** 选择某个模型。 */
  onSelect?: (model: string, group: ModelGroup) => void;
  /** 关闭弹窗。 */
  onClose: () => void;
  /** 可添加的供应商列表。 */
  providers?: ProviderOption[];
  /** 已配置的供应商及其模型，用于模型管理。 */
  managedProviders?: ManagedProvider[];
  /** 连接供应商。 */
  onConnectProvider?: (provider: ProviderOption, values: ConnectValues) => Promise<void>;
  /** 保存模型启用状态。 */
  onSaveModels?: (providers: ManagedProvider[]) => Promise<void>;
}

type PickerView = "select" | "providers" | "manage";

function PlusIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SlidersIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
    </svg>
  );
}

function BackIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function SearchIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** 模型选择弹窗：选择模型、添加供应商、管理已配置模型。 */
export const ModelPicker: Component<ModelPickerProps> = (props) => {
  const [view, setView] = createSignal<PickerView>("select");
  const [query, setQuery] = createSignal("");
  const [providerQuery, setProviderQuery] = createSignal("");

  const [connectTarget, setConnectTarget] = createSignal<ProviderOption | null>(null);
  const [alias, setAlias] = createSignal("");
  const [baseUrl, setBaseUrl] = createSignal("");
  const [apiKey, setApiKey] = createSignal("");
  const [connectSaving, setConnectSaving] = createSignal(false);
  const [connectError, setConnectError] = createSignal("");

  const [drafts, setDrafts] = createSignal<ManagedProvider[]>([]);
  const [manageSaving, setManageSaving] = createSignal(false);
  const [manageError, setManageError] = createSignal("");

  const locale = () => props.locale ?? DEFAULT_LOCALE;

  createEffect(() => {
    if (props.open) {
      setView("select");
      setQuery("");
      setProviderQuery("");
    }
  });

  const title = () => {
    if (view() === "providers") return translate(locale(), "chat.providersTitle", "全部供应商");
    if (view() === "manage") return translate(locale(), "chat.manageModels", "模型管理");
    return translate(locale(), "chat.selectModel", "选择模型");
  };

  const filteredGroups = (): ModelGroup[] => {
    const keyword = query().trim().toLowerCase();
    const groups = props.groups ?? [];
    if (!keyword) return groups;

    const matches = (value: string) => value.toLowerCase().includes(keyword);
    return groups
      .map((group) => {
        const providerMatches = matches(group.providerAlias ?? "") || matches(group.providerName);
        return {
          ...group,
          models: providerMatches
            ? group.models
            : group.models.filter((model) => matches(model.id)),
        };
      })
      .filter((group) => group.models.length > 0);
  };

  const filteredProviders = (): ProviderOption[] => {
    const keyword = providerQuery().trim().toLowerCase();
    const providers = props.providers ?? [];
    if (!keyword) return providers;
    return providers.filter((provider) =>
      provider.name.toLowerCase().includes(keyword)
      || (provider.description ?? "").toLowerCase().includes(keyword)
      || provider.baseUrl.toLowerCase().includes(keyword),
    );
  };

  const openConnect = (provider: ProviderOption) => {
    setConnectTarget(provider);
    setAlias(provider.name);
    setBaseUrl(provider.baseUrl);
    setApiKey("");
    setConnectError("");
  };

  const closeConnect = () => {
    if (connectSaving()) return;
    setConnectTarget(null);
    setConnectError("");
  };

  const submitConnect = async (event: SubmitEvent) => {
    event.preventDefault();
    const provider = connectTarget();
    if (!provider || connectSaving() || !props.onConnectProvider) return;

    const trimmedUrl = baseUrl().trim();
    if (!trimmedUrl) {
      setConnectError(translate(locale(), "chat.baseUrlRequired", "请输入接口地址"));
      return;
    }
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    } catch {
      setConnectError(translate(locale(), "chat.baseUrlInvalid", "接口地址必须是 http/https URL"));
      return;
    }
    if (!apiKey()) {
      setConnectError(translate(locale(), "chat.apiKeyRequired", "请输入 API Key"));
      return;
    }

    setConnectError("");
    setConnectSaving(true);
    try {
      await props.onConnectProvider(provider, {
        alias: alias().trim() || provider.name,
        baseUrl: trimmedUrl,
        apiKey: apiKey(),
      });
      setConnectTarget(null);
    } catch (cause) {
      setConnectError(cause instanceof Error && cause.message
        ? cause.message
        : translate(locale(), "chat.errorFallback", "操作失败，请稍后再试"));
    } finally {
      setConnectSaving(false);
    }
  };

  const openManage = () => {
    setView("manage");
    setDrafts(
      (props.managedProviders ?? []).map((provider) => ({
        ...provider,
        models: provider.models.map((model) => ({ ...model })),
      })),
    );
    setManageError("");
  };

  const toggleModel = (providerIndex: number, modelId: string) => {
    setDrafts((providers) =>
      providers.map((provider, index) =>
        index === providerIndex
          ? {
              ...provider,
              models: provider.models.map((model) =>
                model.id === modelId ? { ...model, enabled: !(model.enabled ?? false) } : model,
              ),
            }
          : provider,
      ),
    );
  };

  const saveManage = async () => {
    if (manageSaving() || !props.onSaveModels) return;
    setManageError("");
    setManageSaving(true);
    try {
      await props.onSaveModels(drafts());
      setView("select");
    } catch (cause) {
      setManageError(cause instanceof Error && cause.message
        ? cause.message
        : translate(locale(), "chat.errorFallback", "操作失败，请稍后再试"));
    } finally {
      setManageSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100";

  return (
    <Show when={props.open}>
      <>
        <div
          class="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="presentation"
          onClick={() => props.onClose()}
        >
          <div
            class="grid w-full max-w-xl gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label={title()}
            onClick={(event) => event.stopPropagation()}
          >
            <header class="flex items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-1">
                <Show when={view() !== "select"}>
                  <button
                    type="button"
                    onClick={() => setView("select")}
                    aria-label={translate(locale(), "chat.back", "返回")}
                    title={translate(locale(), "chat.back", "返回")}
                    class="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  >
                    <BackIcon />
                  </button>
                </Show>
                <h2 class="m-0 truncate text-base font-semibold text-slate-800 dark:text-slate-100">
                  {title()}
                </h2>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <Show when={view() === "select" && (props.providers?.length ?? 0) > 0}>
                  <button
                    type="button"
                    onClick={() => setView("providers")}
                    aria-label={translate(locale(), "chat.addProvider", "添加供应商")}
                    title={translate(locale(), "chat.addProvider", "添加供应商")}
                    class="grid h-7 w-7 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  >
                    <PlusIcon />
                  </button>
                </Show>
                <Show when={view() === "select" && (props.managedProviders?.length ?? 0) > 0}>
                  <button
                    type="button"
                    onClick={openManage}
                    aria-label={translate(locale(), "chat.manageModels", "模型管理")}
                    title={translate(locale(), "chat.manageModels", "模型管理")}
                    class="grid h-7 w-7 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  >
                    <SlidersIcon />
                  </button>
                </Show>
              </div>
            </header>

            <Show when={view() === "select"}>
              <label class="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 text-slate-400 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/30 dark:border-white/15 dark:bg-slate-950/60">
                <SearchIcon />
                <input
                  class="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                  type="search"
                  autocomplete="off"
                  spellcheck={false}
                  placeholder={translate(locale(), "chat.searchModels", "搜索模型")}
                  value={query()}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                />
              </label>

              <div class="grid max-h-96 min-h-72 content-start gap-3 overflow-y-auto pr-1">
                <For
                  each={filteredGroups()}
                  fallback={
                    <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
                      {query().trim()
                        ? translate(locale(), "chat.noMatchModels", "没有匹配的模型")
                        : translate(locale(), "chat.noModels", "暂无可用模型")}
                    </p>
                  }
                >
                  {(group) => (
                    <section class="grid gap-1">
                      <p class="m-0 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {group.providerAlias?.trim() || group.providerName}
                      </p>
                      <For each={group.models}>
                        {(model) => {
                          const disabled = () => model.enabled === false;
                          return (
                            <button
                              type="button"
                              disabled={disabled()}
                              aria-disabled={disabled()}
                              onClick={() => props.onSelect?.(model.id, group)}
                              class={`flex h-9 w-full items-center rounded-lg px-2 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
                                disabled()
                                  ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
                                  : props.activeModel === model.id
                                    ? "bg-blue-500/15 font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                                    : "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/5"
                              }`}
                            >
                              <span class="truncate">{model.modelName?.trim() || model.id}</span>
                            </button>
                          );
                        }}
                      </For>
                    </section>
                  )}
                </For>
              </div>
            </Show>

            <Show when={view() === "providers"}>
              <label class="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 text-slate-400 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/30 dark:border-white/15 dark:bg-slate-950/60">
                <SearchIcon />
                <input
                  class="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                  type="search"
                  autocomplete="off"
                  spellcheck={false}
                  placeholder={translate(locale(), "chat.searchModels", "搜索模型")}
                  value={providerQuery()}
                  onInput={(event) => setProviderQuery(event.currentTarget.value)}
                />
              </label>

              <div class="grid max-h-96 min-h-72 content-start gap-1 overflow-y-auto pr-1">
                <For
                  each={filteredProviders()}
                  fallback={
                    <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
                      {translate(locale(), "chat.noProviders", "暂无可用供应商")}
                    </p>
                  }
                >
                  {(provider) => (
                    <button
                      type="button"
                      onClick={() => openConnect(provider)}
                      class="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left outline-none transition hover:bg-slate-900/5 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-white/10 dark:hover:bg-white/5"
                    >
                      <span class="grid min-w-0 flex-1 gap-0.5">
                        <span class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {provider.name}
                        </span>
                        <Show when={provider.description?.trim()}>
                          <span class="truncate text-[12px] text-slate-500 dark:text-slate-400">
                            {provider.description}
                          </span>
                        </Show>
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <Show when={view() === "manage"}>
              <div class="grid max-h-96 min-h-72 content-start gap-2 overflow-y-auto pr-1">
                <For
                  each={drafts()}
                  fallback={
                    <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
                      {translate(locale(), "chat.noProviders", "暂无可用供应商")}
                    </p>
                  }
                >
                  {(provider, providerIndex) => (
                    <section class="grid gap-1 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                      <div class="flex items-center justify-between gap-2">
                        <span class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {provider.providerAlias?.trim() || provider.providerName}
                        </span>
                        <Show when={provider.baseUrl?.trim()}>
                          <span class="truncate text-[11px] text-slate-400 dark:text-slate-500">
                            {provider.baseUrl}
                          </span>
                        </Show>
                      </div>
                      <For each={provider.models}>
                        {(model) => (
                          <div class="flex h-8 items-center gap-2">
                            <span class="min-w-0 flex-1 truncate text-[13px] text-slate-600 dark:text-slate-300">
                              {model.modelName?.trim() || model.id}
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={model.enabled ?? false}
                              aria-label={translate(locale(), "chat.toggleModel", "启用或停用模型")}
                              disabled={manageSaving()}
                              onClick={() => toggleModel(providerIndex(), model.id)}
                              class={`relative h-5 w-9 shrink-0 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-60 ${
                                model.enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                              }`}
                            >
                              <span
                                class={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${model.enabled ? "translate-x-4" : ""}`}
                              />
                            </button>
                          </div>
                        )}
                      </For>
                    </section>
                  )}
                </For>
              </div>

              <Show when={manageError()}>
                <p class="m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400" role="alert">
                  {manageError()}
                </p>
              </Show>

              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setView("select")}
                  disabled={manageSaving()}
                  class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  {translate(locale(), "chat.cancel", "取消")}
                </button>
                <button
                  type="button"
                  onClick={saveManage}
                  disabled={manageSaving()}
                  class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
                >
                  {manageSaving()
                    ? translate(locale(), "chat.saving", "保存中…")
                    : translate(locale(), "chat.save", "保存")}
                </button>
              </div>
            </Show>
          </div>
        </div>

        <Show when={connectTarget()}>
          <div
            class="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4"
            role="presentation"
            onClick={() => closeConnect()}
          >
            <form
              class="grid w-full max-w-sm gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
              role="dialog"
              aria-modal="true"
              aria-label={translate(locale(), "chat.connectTitle", "连接供应商")}
              onClick={(event) => event.stopPropagation()}
              onSubmit={submitConnect}
              aria-busy={connectSaving()}
            >
              <header class="grid gap-1">
                <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
                  {translate(locale(), "chat.connectTitle", "连接供应商")}
                </h2>
                <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
                  {connectTarget()?.name}
                </p>
              </header>

              <label class="grid gap-2">
                <span class="text-[13px] text-slate-600 dark:text-slate-300">
                  {translate(locale(), "chat.alias", "别称")}
                </span>
                <input
                  class={inputClass}
                  type="text"
                  autocomplete="off"
                  spellcheck={false}
                  disabled={connectSaving()}
                  value={alias()}
                  onInput={(event) => setAlias(event.currentTarget.value)}
                />
              </label>

              <label class="grid gap-2">
                <span class="text-[13px] text-slate-600 dark:text-slate-300">
                  {translate(locale(), "chat.baseUrl", "接口地址")}
                </span>
                <input
                  class={inputClass}
                  type="url"
                  inputmode="url"
                  autocomplete="url"
                  spellcheck={false}
                  required
                  disabled={connectSaving()}
                  value={baseUrl()}
                  onInput={(event) => setBaseUrl(event.currentTarget.value)}
                />
              </label>

              <label class="grid gap-2">
                <span class="text-[13px] text-slate-600 dark:text-slate-300">
                  {translate(locale(), "chat.apiKey", "API Key")}
                </span>
                <input
                  class={inputClass}
                  type="password"
                  autocomplete="off"
                  spellcheck={false}
                  required
                  autofocus
                  disabled={connectSaving()}
                  value={apiKey()}
                  onInput={(event) => setApiKey(event.currentTarget.value)}
                />
              </label>

              <Show when={connectError()}>
                <p class="m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400" role="alert">
                  {connectError()}
                </p>
              </Show>

              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => closeConnect()}
                  disabled={connectSaving()}
                  class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  {translate(locale(), "chat.cancel", "取消")}
                </button>
                <button
                  type="submit"
                  disabled={connectSaving()}
                  class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
                >
                  {connectSaving()
                    ? translate(locale(), "chat.saving", "保存中…")
                    : translate(locale(), "chat.save", "保存")}
                </button>
              </div>
            </form>
          </div>
        </Show>
      </>
    </Show>
  );
};
