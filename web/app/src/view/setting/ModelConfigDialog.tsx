import { For, Show, createSignal } from "solid-js";
import type { SupplierProviderModelsResponse } from "@loong/web-api";
import { Dialog } from "@kobalte/core/dialog";
import { Switch } from "@kobalte/core/switch";

import { useLocaleContext } from "../../context/LocaleContext";
import { useServerContext } from "../../context/ServerContext";
import { HttpRequestError, api_client } from "../../runtime/http";

export interface ModelConfigDialogProps {
  provider: SupplierProviderModelsResponse;
  onClose: () => void;
  onSaved: () => void;
}

/** 启用 / 停用供应商模型。 */
export function ModelConfigDialog(props: ModelConfigDialogProps) {
  const {locale, t} = useLocaleContext();
  const {serverUrl, securityToken} = useServerContext();
  const [models, setModels] = createSignal(
    props.provider.models.map((model) => ({
      model: model.model,
      enabled: model.enabled,
      reasoning_effort: model.reasoning_effort,
    })),
  );
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const toggle = (name: string) => {
    setModels((current) => current.map((model) =>
      model.model === name ? {...model, enabled: !model.enabled} : model));
  };

  const save = async () => {
    const changed = models().filter((model, index) =>
      model.enabled !== props.provider.models[index]?.enabled);
    if (changed.length === 0) {
      props.onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const client = api_client({
        baseUrl: serverUrl(),
        securityToken: securityToken(),
        locale: locale(),
        translate: t,
      });
      await Promise.all(changed.map((model) => client.supplierConfig.saveOption({
        provider: props.provider.provider,
        model: model.model,
        enabled: model.enabled,
      })));
      props.onSaved();
      props.onClose();
    } catch (reason) {
      setError(reason instanceof HttpRequestError ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open modal onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content class="fixed left-1/2 top-1/2 z-[70] flex max-h-[70vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
          <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div class="grid min-w-0 gap-0.5">
              <Dialog.Title class="m-0 truncate text-base font-semibold">
                {props.provider.alias || props.provider.provider}
              </Dialog.Title>
              <Dialog.Description class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
                {t("model.configDescription", "启用或停用该供应商支持的模型。")}
              </Dialog.Description>
            </div>
            <Dialog.CloseButton
              aria-label={t("model.cancel", "关闭")}
              title={t("model.cancel", "关闭")}
              class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ✕
            </Dialog.CloseButton>
          </header>

          <div class="min-h-0 flex-1 overflow-auto p-5">
            <div class="grid gap-2">
              <For each={models()}>
                {(model) => (
                  <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <span class="truncate text-[13px] text-slate-700 dark:text-slate-200">
                      {model.model}
                    </span>
                    <Switch
                      checked={model.enabled}
                      onChange={() => toggle(model.model)}
                      class="inline-flex shrink-0 items-center"
                    >
                      <Switch.Control
                        as="button"
                        type="button"
                        aria-label={model.enabled
                          ? t("model.disable", "停用模型")
                          : t("model.enable", "启用模型")}
                        class="relative h-5 w-9 rounded-full bg-slate-300 outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 data-[checked]:bg-indigo-500 dark:bg-slate-700 dark:data-[checked]:bg-indigo-500"
                      >
                        <Switch.Thumb class="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[checked]:translate-x-4" />
                      </Switch.Control>
                    </Switch>
                  </div>
                )}
              </For>
            </div>

            <Show when={error()}>
              <p role="alert" class="mt-3 text-[12px] font-medium text-red-600 dark:text-red-400">
                {error()}
              </p>
            </Show>
          </div>

          <footer class="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
            <button
              type="button"
              onClick={props.onClose}
              disabled={saving()}
              class="h-9 rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700 outline-none transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("model.cancel", "取消")}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving()}
              class="h-9 rounded-lg bg-indigo-500 px-4 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving() ? t("model.saving", "保存中…") : t("model.save", "保存")}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
