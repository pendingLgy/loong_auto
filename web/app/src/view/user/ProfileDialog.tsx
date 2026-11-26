import { Dialog } from "@kobalte/core/dialog";

import { useLocaleContext } from "../../context/LocaleContext";
import { useLoginContext } from "../../context/LoginContext";

export interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 个人信息弹窗。 */
export function ProfileDialog(props: ProfileDialogProps) {
  const {t} = useLocaleContext();
  const {user} = useLoginContext();

  const rows = () => [
    [t("user.profile.username", "用户名"), user()?.username ?? "-"],
    [t("user.profile.name", "显示名称"), user()?.name ?? "-"],
  ];

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content class="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
          <header class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <Dialog.Title class="m-0 text-base font-semibold">
              {t("user.profile.title", "个人信息")}
            </Dialog.Title>
            <Dialog.CloseButton
              aria-label={t("user.profile.close", "关闭")}
              title={t("user.profile.close", "关闭")}
              class="grid h-8 w-8 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ✕
            </Dialog.CloseButton>
          </header>
          <dl class="m-0 grid gap-3 p-5">
            {rows().map(([label, value]) => (
              <div class="grid gap-0.5">
                <dt class="text-[11px] text-slate-400 dark:text-slate-500">{label}</dt>
                <dd class="m-0 truncate text-[13px] text-slate-700 dark:text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
