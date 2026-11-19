import { For, Show, createSignal, type Component } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import type { ModelInfo, ProviderModelGroup, SettingsModelOptions } from "./types";

export interface SettingsModelSectionProps extends SettingsModelOptions {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  class?: string;
}

function modelLabel(model: ModelInfo): string {
  return model.name?.trim() || model.id;
}

/** 设置面板右侧的「模型」内容：按供应商分组，点击卡片批量控制模型启用状态。 */
export const SettingsModelSection: Component<SettingsModelSectionProps> = (props) => {
  const [detailProvider, setDetailProvider] = createSignal<ProviderModelGroup | null>(null);
  const [draftModels, setDraftModels] = createSignal<ModelInfo[]>([]);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");

  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const openDetail = (provider: ProviderModelGroup) => {
    setDetailProvider(provider);
    setDraftModels(provider.models.map((model) => ({ ...model })));
    setError("");
  };

  const closeDetail = () => {
    if (saving()) return;
    setDetailProvider(null);
    setError("");
  };

  const toggleModel = (modelId: string) => {
    setDraftModels((models) =>
      models.map((model) =>
        model.id === modelId ? { ...model, enabled: !(model.enabled ?? false) } : model,
      ),
    );
  };

  const handleSave = async () => {
    const provider = detailProvider();
    if (!provider || saving()) return;

    setSaving(true);
    setError("");

    try {
      await props.onSaveModels?.(provider, draftModels());
      setDetailProvider(null);
    } catch (cause) {
      setError(cause instanceof Error && cause.message
        ? cause.message
        : translate(locale(), "settings.errors.fallback", "保存失败，请稍后再试"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div class={`grid gap-3 ${props.class ?? ""}`}>
        <header class="grid gap-1">
          <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
            {translate(locale(), "settings.model.title", "模型")}
          </h2>
          <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
            {translate(locale(), "settings.model.description", "管理已配置供应商提供的模型，点击供应商可启用或停用模型")}
          </p>
        </header>

        <For
          each={props.providers ?? []}
          fallback={
            <div class="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
              <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
                {translate(locale(), "settings.model.empty", "尚未配置供应商或模型")}
              </p>
            </div>
          }
        >
          {(provider: ProviderModelGroup) => (
            <button
              type="button"
              onClick={() => openDetail(provider)}
              class="grid w-full gap-2 rounded-2xl border border-slate-200 bg-white/90 p-4 text-left shadow-sm outline-none transition hover:bg-slate-900/[0.03] focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-white/10 dark:bg-slate-900/80 dark:hover:bg-white/[0.03]"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {provider.alias?.trim() || provider.providerName}
                </span>
                <span class="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                  {provider.providerName}
                </span>
              </div>
              <p class="m-0 truncate text-[11px] text-slate-500 dark:text-slate-400">
                {provider.baseUrl}
              </p>
              <div class="flex flex-wrap gap-1">
                <Show
                  when={provider.models.length > 0}
                  fallback={
                    <span class="text-[11px] text-slate-400 dark:text-slate-500">
                      {translate(locale(), "settings.model.noModels", "暂无模型")}
                    </span>
                  }
                >
                  <For each={provider.models}>
                    {(model) => (
                      <span class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-900/5 px-2 py-0.5 text-[11px] text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                        <span
                          class={`h-1.5 w-1.5 shrink-0 rounded-full ${model.enabled ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-500"}`}
                          aria-hidden="true"
                        />
                        {modelLabel(model)}
                      </span>
                    )}
                  </For>
                </Show>
              </div>
            </button>
          )}
        </For>
      </div>

      <Show when={detailProvider()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="presentation"
          onClick={() => closeDetail()}
        >
          <div
            class="grid w-full max-w-md gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label={translate(locale(), "settings.model.providerModelsTitle", "供应商模型")}
            onClick={(event) => event.stopPropagation()}
            aria-busy={saving()}
          >
            <header class="grid gap-1">
              <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
                {detailProvider()?.alias?.trim() || detailProvider()?.providerName}
              </h2>
              <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
                {detailProvider()?.baseUrl}
              </p>
            </header>

            <div class="grid max-h-72 gap-1 overflow-y-auto pr-1">
              <For
                each={draftModels()}
                fallback={
                  <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
                    {translate(locale(), "settings.model.noModels", "暂无模型")}
                  </p>
                }
              >
                {(model) => (
                  <div class="flex h-10 items-center gap-2 rounded-lg px-2 transition hover:bg-slate-900/5 dark:hover:bg-white/5">
                    <span class="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                      {modelLabel(model)}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={model.enabled ?? false}
                      aria-label={modelLabel(model)}
                      disabled={saving()}
                      onClick={() => toggleModel(model.id)}
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
            </div>

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
                onClick={() => closeDetail()}
                disabled={saving()}
                class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                {translate(locale(), "settings.provider.cancel", "取消")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving()}
                class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
              >
                {saving()
                  ? translate(locale(), "settings.provider.saving", "保存中…")
                  : translate(locale(), "settings.provider.save", "保存")}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};
