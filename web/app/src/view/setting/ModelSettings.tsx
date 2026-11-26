import { For, Show, createSignal, onSettled } from "solid-js";
import type { SupplierProviderModelsResponse } from "@loong/web-api";

import { useLocaleContext } from "../../context/LocaleContext";
import { useServerContext } from "../../context/ServerContext";
import { HttpRequestError, api_client } from "../../runtime/http";
import { ModelConfigDialog } from "./ModelConfigDialog";

/** 已配置供应商及其支持模型的启用状态。 */
export function ModelSettings() {
  const {locale, t} = useLocaleContext();
  const {serverUrl, securityToken} = useServerContext();
  const [providers, setProviders] = createSignal<SupplierProviderModelsResponse[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selected, setSelected] = createSignal<SupplierProviderModelsResponse | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api_client({
        baseUrl: serverUrl(),
        securityToken: securityToken(),
        locale: locale(),
        translate: t,
      }).supplierConfig.listModels();
      setProviders(result);
    } catch (reason) {
      setError(reason instanceof HttpRequestError ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  onSettled(() => {
    void load();
  });

  return (
    <section class="grid gap-4">
      <div class="flex items-center justify-between gap-2">
        <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
          {t("model.description", "查看各供应商支持的模型与启用状态。")}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading()}
          class="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {loading() ? t("model.loading", "加载中…") : t("model.refresh", "刷新")}
        </button>
      </div>

      <Show when={error()}>
        <p role="alert" class="m-0 text-[12px] text-red-600 dark:text-red-400">
          {error()}
        </p>
      </Show>

      <Show when={!loading() && providers().length === 0}>
        <p class="m-0 rounded-lg border border-dashed border-slate-300 p-3 text-[12px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
          {t("model.empty", "暂无可用的模型。")}
        </p>
      </Show>

      <div class="grid gap-3">
        <For each={providers()}>
          {(provider) => (
            <button
              type="button"
              onClick={() => setSelected(provider)}
              class="grid w-full gap-2 rounded-lg border border-slate-200 p-3 text-left outline-none transition hover:border-indigo-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-slate-700 dark:hover:border-indigo-700 dark:hover:bg-slate-800/60"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex min-w-0 items-center gap-1">
                  <span class="truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">
                    {provider.alias || provider.provider}
                  </span>
                  <Show when={provider.alias}>
                    <span class="truncate text-[11px] text-slate-400 dark:text-slate-500">
                      {provider.provider}
                    </span>
                  </Show>
                </div>
                <span class="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                  {provider.models.length}
                </span>
              </div>

              <div class="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
                <For each={provider.models}>
                  {(model) => (
                    <span
                      title={model.enabled
                        ? t("model.enabled", "已启用")
                        : t("model.disabled", "未启用")}
                      class={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                        model.enabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      <span class="truncate">{model.model}</span>
                      <span
                        aria-hidden="true"
                        class={`h-1.5 w-1.5 rounded-full ${
                          model.enabled
                            ? "bg-emerald-500"
                            : "bg-slate-400 dark:bg-slate-500"
                        }`}
                      />
                    </span>
                  )}
                </For>
              </div>
            </button>
          )}
        </For>
      </div>

      <Show when={selected()}>
        {(provider) => (
          <ModelConfigDialog
            provider={provider()}
            onClose={() => setSelected(null)}
            onSaved={() => void load()}
          />
        )}
      </Show>
    </section>
  );
}
