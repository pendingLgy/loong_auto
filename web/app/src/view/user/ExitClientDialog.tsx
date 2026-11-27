import { Dialog } from "@kobalte/core/dialog";

import { useLocaleContext } from "../../context/LocaleContext";

export interface ExitClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** 退出当前客户端确认弹窗。 */
export function ExitClientDialog(props: ExitClientDialogProps) {
  const {t} = useLocaleContext();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content class="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
          <Dialog.Title class="m-0 text-base font-semibold">
            {t("server.exitTitle", "退出当前客户端？")}
          </Dialog.Title>
          <Dialog.Description class="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("server.exitDescription", "退出后将清除当前客户端配置，并打开客户端配置弹窗。")}
          </Dialog.Description>
          <div class="mt-4 flex justify-end gap-2">
            <Dialog.CloseButton class="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              {t("server.cancel", "取消")}
            </Dialog.CloseButton>
            <button
              type="button"
              onClick={() => {
                props.onConfirm();
                props.onOpenChange(false);
              }}
              class="rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white outline-none transition hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-500/40"
            >
              {t("server.exitConfirm", "退出")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
