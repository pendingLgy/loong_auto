import {createSignal, Show} from "solid-js";
import type {SupplierConfigResponse} from "@loong/web-api";
import {Dialog} from "@kobalte/core/dialog";

import {useLocaleContext} from "../../context/LocaleContext";
import {useServerContext} from "../../context/ServerContext";
import {toErrorMessage} from "../../runtime/http_client_wrap";

export interface SupplierDeleteDialogProps {
  supplier: SupplierConfigResponse;
  onClose: () => void;
  onDeleted: () => void;
}

/** 移除供应商配置确认弹窗。 */
export function SupplierDeleteDialog(props: SupplierDeleteDialogProps) {
  const {locale, t} = useLocaleContext();
  const {api_client_proxy} = useServerContext();
  const [deleting, setDeleting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api_client_proxy().supplierConfig.remove({provider: props.supplier.provider});
      props.onDeleted();
      props.onClose();
    } catch (reason) {
      setError(toErrorMessage(reason));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open modal onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-sm"/>
        <Dialog.Content
          class="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
          <Dialog.Title class="m-0 text-base font-semibold">
            {t("supplier.deleteTitle", "移除供应商？")}
          </Dialog.Title>
          <Dialog.Description
            class="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t(
              "supplier.deleteDescription",
              "将移除 {name} 的配置，已保存的 API Key 也会被删除。",
              {name: props.supplier.alias || props.supplier.provider},
            )}
          </Dialog.Description>

          <Show when={error()}>
            <p role="alert" class="mt-3 text-[12px] font-medium text-red-600 dark:text-red-400">
              {error()}
            </p>
          </Show>

          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={props.onClose}
              disabled={deleting()}
              class="h-9 rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700 outline-none transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("supplier.cancel", "取消")}
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting()}
              class="h-9 rounded-lg bg-red-600 px-3 text-[13px] font-medium text-white outline-none transition hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting()
                ? t("supplier.deleting", "移除中…")
                : t("supplier.deleteConfirm", "移除")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
