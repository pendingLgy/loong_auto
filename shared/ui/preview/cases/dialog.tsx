import { createSignal } from "solid-js";

import { Dialog, type DialogSize } from "../../src/dialog";
import type { PreviewCase } from "../types";

function DialogCase(props: { size?: DialogSize; closable?: boolean }) {
  const [open, setOpen] = createSignal(true);

  return (
    <div class="grid gap-3 p-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        class="w-fit rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500"
      >
        打开对话框
      </button>

      <Dialog
        open={open()}
        onClose={() => setOpen(false)}
        size={props.size}
        closable={props.closable}
        header={
          <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
            对话框标题
          </h2>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500"
            >
              确认
            </button>
          </>
        }
      >
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          这是对话框内容，可通过遮罩、右上角关闭按钮或 Esc 关闭。
        </p>
      </Dialog>
    </div>
  );
}

export const dialogCases: PreviewCase[] = [
  {
    id: "dialog-default",
    group: "Dialog",
    title: "默认",
    render: () => <DialogCase />,
  },
  {
    id: "dialog-large",
    group: "Dialog",
    title: "大宽度",
    render: () => <DialogCase size="lg" />,
  },
  {
    id: "dialog-no-close",
    group: "Dialog",
    title: "无关闭按钮",
    render: () => <DialogCase closable={false} />,
  },
];
