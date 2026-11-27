import {createSignal, For, onSettled, Show} from "solid-js";
import type {SupplierConfigResponse} from "@loong/web-api";

import {useLocaleContext} from "../../context/LocaleContext";
import {useServerContext} from "../../context/ServerContext";
import {PopularIcon} from "../../assets/icons/PopularIcon";
import {SupplierConfigDialog} from "./SupplierConfigDialog";
import {SupplierDeleteDialog} from "./SupplierDeleteDialog";
import {TrashIcon} from "../../assets/icons/TrashIcon";
import {toErrorMessage} from "../../runtime/http_client_wrap";

function toSupplierConfig(value: SupplierConfigResponse): SupplierConfigResponse {
  const raw = value as unknown as Record<string, unknown>;
  return {
    id: typeof raw.id === "string" ? raw.id : String(raw.id ?? ""),
    provider: typeof raw.provider === "string" ? raw.provider : "",
    alias: typeof raw.alias === "string" ? raw.alias : null,
    popular: raw.popular === true,
    description: typeof raw.description === "string" ? raw.description : "",
    base_url: typeof raw.base_url === "string" ? raw.base_url : null,
    config_flag: raw.config_flag === true,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

function SupplierCard(props: {
  supplier: SupplierConfigResponse;
  configuredLabel: string;
  missingLabel: string;
  showPopular?: boolean;
  showMeta?: boolean;
  onSelect: (supplier: SupplierConfigResponse) => void;
  onDelete?: () => void;
}) {
  const {t} = useLocaleContext();
  const supplier = props.supplier;

  return (
    <div
      class="group relative rounded-lg border border-slate-200 transition hover:border-indigo-300 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-indigo-500/40 dark:border-slate-700 dark:hover:border-indigo-700 dark:hover:bg-slate-800/60">
      <button
        type="button"
        onClick={() => props.onSelect(supplier)}
        class="grid w-full gap-1 px-3 pt-3 pb-1 text-left outline-none"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-1">
          <span class="truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">
            {supplier.alias || supplier.provider}
          </span>
            <Show when={supplier.alias}>
            <span class="truncate text-[11px] text-slate-400 dark:text-slate-500">
              {supplier.provider}
            </span>
            </Show>
            <Show when={props.showPopular && supplier.popular}>
              <PopularIcon class="h-3.5 w-3.5 shrink-0 text-amber-500"/>
            </Show>
          </div>
          <span
            class={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
              supplier.config_flag
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
          {supplier.config_flag ? props.configuredLabel : props.missingLabel}
        </span>
        </div>
        <Show when={supplier.description}>
        <span class="line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {supplier.description}
        </span>
        </Show>
      </button>

      <Show when={(props.showMeta !== false && supplier.base_url) || props.onDelete}>
        <div class="flex items-center justify-between gap-2 px-3 pb-2">
          <Show when={props.showMeta !== false && supplier.base_url}>
            <span class="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {supplier.base_url}
            </span>
          </Show>
          <Show when={props.onDelete}>
            <button
              type="button"
              onClick={() => props.onDelete?.()}
              aria-label={t("supplier.delete", "移除供应商")}
              title={t("supplier.delete", "移除供应商")}
              class="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-slate-400 outline-none transition hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40"
            >
              <TrashIcon class="h-3.5 w-3.5"/>
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

/** 供应商配置列表，按已配置 / 未配置分组。 */
export function SupplierSettings() {
  const {locale, t} = useLocaleContext();
  const {api_client_proxy} = useServerContext();
  const [configuredSuppliers, setConfiguredSuppliers] = createSignal<SupplierConfigResponse[]>([]);
  const [unconfiguredSuppliers, setUnconfiguredSuppliers] = createSignal<SupplierConfigResponse[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selected, setSelected] = createSignal<SupplierConfigResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = createSignal<SupplierConfigResponse | null>(null);

  const configured = () => configuredSuppliers();
  const unconfigured = () => unconfiguredSuppliers()
    .slice()
    .sort((a, b) => Number(b.popular) - Number(a.popular));
  const configuredLabel = () => t("supplier.configured", "已配置");
  const missingLabel = () => t("supplier.notConfigured", "未配置");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {

      const [configuredResult, allResult] = await Promise.all([
        api_client_proxy().supplierConfig.listConfigured(),
        api_client_proxy().supplierConfig.list(),
      ]);
      setConfiguredSuppliers(configuredResult.map(toSupplierConfig));
      setUnconfiguredSuppliers(
        allResult
          .map(toSupplierConfig)
          .filter((supplier) => !supplier.config_flag),
      );
    } catch (reason) {
      setError(toErrorMessage(reason));
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
          {t("supplier.description", "查看已接入的模型供应商。")}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading()}
          class="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {loading() ? t("supplier.loading", "加载中…") : t("supplier.refresh", "刷新")}
        </button>
      </div>

      <Show when={error()}>
        <p role="alert" class="m-0 text-[12px] text-red-600 dark:text-red-400">
          {error()}
        </p>
      </Show>

      <section class="grid gap-2">
        <header class="flex items-center justify-between gap-2">
          <h3 class="m-0 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
            {t("supplier.configuredTitle", "已配置的供应商")}
          </h3>
          <span class="text-[10px] text-slate-400 dark:text-slate-500">
            {configured().length}
          </span>
        </header>
        <Show
          when={configured().length > 0}
          fallback={
            <p
              class="m-0 rounded-lg border border-dashed border-slate-300 p-3 text-[12px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
              {t("supplier.noneConfigured", "暂无已配置的供应商。")}
            </p>
          }
        >
          <div class="grid gap-2">
            <For each={configured()}>
              {(supplier) => (
                <SupplierCard
                  supplier={supplier}
                  configuredLabel={configuredLabel()}
                  missingLabel={missingLabel()}
                  onSelect={setSelected}
                  onDelete={() => setDeleteTarget(supplier)}
                />
              )}
            </For>
          </div>
        </Show>
      </section>

      <section class="grid gap-2">
        <header class="flex items-center justify-between gap-2">
          <h3 class="m-0 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
            {t("supplier.unconfiguredTitle", "未配置的供应商")}
          </h3>
          <span class="text-[10px] text-slate-400 dark:text-slate-500">
            {unconfigured().length}
          </span>
        </header>
        <Show
          when={unconfigured().length > 0}
          fallback={
            <p
              class="m-0 rounded-lg border border-dashed border-slate-300 p-3 text-[12px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
              {t("supplier.noneUnconfigured", "暂无未配置的供应商。")}
            </p>
          }
        >
          <div class="grid gap-2">
            <For each={unconfigured()}>
              {(supplier) => (
                <SupplierCard
                  supplier={supplier}
                  configuredLabel={configuredLabel()}
                  missingLabel={missingLabel()}
                  showPopular
                  showMeta={false}
                  onSelect={setSelected}
                />
              )}
            </For>
          </div>
        </Show>
      </section>

      <Show when={selected()}>
        {(supplier) => (
          <SupplierConfigDialog
            supplier={supplier()}
            onClose={() => setSelected(null)}
            onSaved={() => void load()}
          />
        )}
      </Show>

      <Show when={deleteTarget()}>
        {(supplier) => (
          <SupplierDeleteDialog
            supplier={supplier()}
            onClose={() => setDeleteTarget(null)}
            onDeleted={() => void load()}
          />
        )}
      </Show>
    </section>
  );
}
