import {createSignal, Show} from "solid-js";
import type {SupplierConfigResponse} from "@loong/web-api";
import {Dialog} from "@kobalte/core/dialog";

import {useLocaleContext} from "../../context/LocaleContext";
import {useServerContext} from "../../context/ServerContext";
import {toErrorMessage} from "../../runtime/http_client_wrap";

export interface SupplierConfigDialogProps {
  supplier: SupplierConfigResponse;
  onClose: () => void;
  onSaved: () => void;
}

/** 供应商配置弹窗：别名、URL 与 API Key。 */
export function SupplierConfigDialog(props: SupplierConfigDialogProps) {
  const {locale, t} = useLocaleContext();
  const {api_client_proxy} = useServerContext();
  const [alias, setAlias] = createSignal(props.supplier.alias || props.supplier.provider);
  const [url, setUrl] = createSignal(props.supplier.base_url ?? "");
  const [apiKey, setApiKey] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const client = api_client_proxy();

  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    setError(null);

    const provider = props.supplier.provider;
    const nextAlias = alias().trim();
    const nextUrl = url().trim();
    const nextKey = apiKey().trim();

    if (!props.supplier.config_flag && !nextKey) {
      setError(t("supplier.apiKeyRequired", "请输入 API Key"));
      return;
    }

    setSaving(true);
    try {
      if (nextKey || nextUrl !== (props.supplier.base_url ?? "")) {
        await client.supplierConfig.save({
          provider,
          api_key: nextKey,
          base_url: nextUrl || undefined,
        });
      }
      const currentAlias = props.supplier.alias || props.supplier.provider;
      if (nextAlias && nextAlias !== currentAlias) {
        await client.supplierConfig.rename({provider, alias: nextAlias});
      }
      props.onSaved();
      props.onClose();
    } catch (reason) {
      setError(toErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

  return (
    <Dialog open modal onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-sm"/>
        <Dialog.Content
          class="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
          <header
            class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div class="grid min-w-0 gap-0.5">
              <span class="text-[11px] text-slate-400 dark:text-slate-500">
                {t("supplier.configTitle", "配置供应商")}
              </span>
              <Dialog.Title class="m-0 truncate text-base font-semibold">
                {props.supplier.alias || props.supplier.provider}
              </Dialog.Title>
              <Dialog.Description
                class="m-0 line-clamp-2 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                {props.supplier.description || props.supplier.provider}
              </Dialog.Description>
            </div>
            <Dialog.CloseButton
              aria-label={t("supplier.cancel", "关闭")}
              title={t("supplier.cancel", "关闭")}
              class="grid h-8 w-8 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ✕
            </Dialog.CloseButton>
          </header>

          <form class="grid gap-4 p-5" onSubmit={save}>
            <label class="grid gap-1.5">
              <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {t("supplier.alias", "别名")}
              </span>
              <input
                value={alias()}
                onInput={(event) => setAlias(event.currentTarget.value)}
                class={inputClass}
              />
            </label>

            <label class="grid gap-1.5">
              <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {t("supplier.url", "URL")}
              </span>
              <input
                value={url()}
                onInput={(event) => setUrl(event.currentTarget.value)}
                placeholder="https://api.example.com"
                autocomplete="url"
                class={inputClass}
              />
            </label>

            <label class="grid gap-1.5">
              <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {t("supplier.apiKey", "API Key")}
              </span>
              <input
                value={apiKey()}
                onInput={(event) => setApiKey(event.currentTarget.value)}
                type="password"
                autocomplete="off"
                placeholder={props.supplier.config_flag
                  ? t("supplier.apiKeyKeep", "留空则不修改")
                  : undefined}
                class={inputClass}
              />
            </label>

            <Show when={error()}>
              <p role="alert" class="m-0 text-[13px] font-medium text-red-600 dark:text-red-400">
                {error()}
              </p>
            </Show>

            <div class="flex justify-end gap-2">
              <button
                type="button"
                onClick={props.onClose}
                disabled={saving()}
                class="h-9 rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700 outline-none transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t("supplier.cancel", "取消")}
              </button>
              <button
                type="submit"
                disabled={saving()}
                class="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-500 px-4 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving()
                  ? t("supplier.saving", "保存中…")
                  : t("supplier.save", "保存")}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
