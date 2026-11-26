import { Dialog } from "@kobalte/core/dialog";

import { useLocaleContext } from "../../context/LocaleContext";

export interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 修改密码入口；等待云端提供修改密码接口。 */
export function ChangePasswordDialog(props: ChangePasswordDialogProps) {
  const {t} = useLocaleContext();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content class="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
          <Dialog.Title class="m-0 text-base font-semibold">
            {t("user.password.title", "修改密码")}
          </Dialog.Title>
          <Dialog.Description class="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("user.password.unavailable", "当前版本暂未开放修改密码，请稍后再试。")}
          </Dialog.Description>
          <div class="mt-4 flex justify-end">
            <Dialog.CloseButton class="rounded-lg bg-indigo-500 px-3 py-1.5 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40">
              {t("user.profile.close", "关闭")}
            </Dialog.CloseButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
