import { For, Show, createSignal, type Component, type JSX } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import type { ModelProviderValues, SettingsProviderOptions } from "./types";

export interface SettingsProviderSectionProps extends SettingsProviderOptions {
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

/** 设置面板右侧的「模型供应商」内容：已配置列表 + 添加供应商表单。 */
export const SettingsProviderSection: Component<SettingsProviderSectionProps> = (props) => {
  const [name, setName] = createSignal(props.initialValue?.name ?? "");
  const [baseUrl, setBaseUrl] = createSignal(props.initialValue?.baseUrl ?? "");
  const [apiKey, setApiKey] = createSignal(props.initialValue?.apiKey ?? "");
  const [model, setModel] = createSignal(props.initialValue?.model ?? "");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");

  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    if (saving() || !props.onAdd) return;

    const values: ModelProviderValues = {
      name: name().trim(),
      baseUrl: baseUrl().trim(),
      apiKey: apiKey(),
      model: model().trim(),
    };

    if (!values.name) {
      setError(translate(locale(), "settings.errors.providerNameRequired", "请输入供应商名称"));
      return;
    }
    if (!values.baseUrl) {
      setError(translate(locale(), "settings.errors.providerBaseUrlRequired", "请输入接口地址"));
      return;
    }
    if (!isHttpUrl(values.baseUrl)) {
      setError(translate(locale(), "settings.errors.providerBaseUrlInvalid",
        "接口地址必须是 http/https URL"));
      return;
    }
    if (!values.apiKey) {
      setError(translate(locale(), "settings.errors.providerApiKeyRequired", "请输入 API Key"));
      return;
    }

    setError("");
    setSaving(true);

    void props.onAdd(values)
      .catch((cause: unknown) => {
        setError(cause instanceof Error && cause.message
          ? cause.message
          : translate(locale(), "settings.errors.fallback", "保存失败，请稍后再试"));
      })
      .finally(() => setSaving(false));
  };

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100";

  return (
    <div class={`grid gap-4 ${props.class ?? ""}`}>
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
            <div class="flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 transition hover:bg-slate-900/5 dark:border-white/10 dark:hover:bg-white/5">
              <span class="grid min-w-0 flex-1">
                <span class="truncate text-sm text-slate-700 dark:text-slate-200">
                  {provider.name}
                </span>
                <span class="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {provider.baseUrl}
                </span>
              </span>
              <Show when={provider.model?.trim()}>
                <span class="shrink-0 rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  {provider.model}
                </span>
              </Show>
            </div>
          )}
        </For>
      </div>

      <form
        class="grid gap-4 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80"
        onSubmit={handleSubmit}
        aria-busy={saving()}
      >
        <h2 class="m-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {translate(locale(), "settings.provider.addTitle", "添加模型供应商")}
        </h2>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "settings.provider.name", "名称")}
          </span>
          <input
            class={inputClass}
            name="name"
            type="text"
            autocomplete="off"
            spellcheck={false}
            placeholder={translate(locale(), "settings.provider.namePlaceholder", "例如：OpenAI")}
            required
            disabled={saving()}
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </label>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "settings.provider.baseUrl", "接口地址")}
          </span>
          <input
            class={inputClass}
            name="baseUrl"
            type="url"
            inputmode="url"
            autocomplete="url"
            spellcheck={false}
            placeholder={translate(locale(), "settings.provider.baseUrlPlaceholder",
              "https://api.openai.com/v1")}
            required
            disabled={saving()}
            value={baseUrl()}
            onInput={(event) => setBaseUrl(event.currentTarget.value)}
          />
        </label>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "settings.provider.apiKey", "API Key")}
          </span>
          <input
            class={inputClass}
            name="apiKey"
            type="password"
            autocomplete="off"
            spellcheck={false}
            placeholder={translate(locale(), "settings.provider.apiKeyPlaceholder", "粘贴 API Key")}
            required
            disabled={saving()}
            value={apiKey()}
            onInput={(event) => setApiKey(event.currentTarget.value)}
          />
        </label>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "settings.provider.model", "默认模型")}
          </span>
          <input
            class={inputClass}
            name="model"
            type="text"
            autocomplete="off"
            spellcheck={false}
            placeholder={translate(locale(), "settings.provider.modelPlaceholder", "例如：gpt-4o")}
            disabled={saving()}
            value={model()}
            onInput={(event) => setModel(event.currentTarget.value)}
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

        <div class="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving()}
            class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
          >
            {saving()
              ? translate(locale(), "settings.provider.adding", "添加中…")
              : translate(locale(), "settings.provider.add", "添加供应商")}
          </button>
        </div>
      </form>
    </div>
  );
};
