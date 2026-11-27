import { createSignal } from "solid-js";

import {
  WorkspaceDialog,
  type WorkspaceDialogController,
  type WorkspaceSaveData,
} from "../../../src";

const initial: WorkspaceSaveData = {
  name: "Demo",
  paths: ["D:\\workspace\\demo"],
};

/** 工作区错误提示与 cleanError 预览。 */
export function WorkspaceErrorPreview() {
  const [saveOpen, setSaveOpen] = createSignal(false);
  let controller: WorkspaceDialogController | undefined;

  return (
    <div class="grid gap-5">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          错误提示
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          保存回调失败与手动清理错误。
        </p>
      </div>

      <div class="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            class="inline-flex h-9 items-center rounded-md bg-indigo-500 px-3 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            模拟保存失败
          </button>
          <button
            type="button"
            onClick={() => controller?.cleanError()}
            class="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-[13px] font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            清空错误
          </button>
        </div>
        <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
          保存失败由 onSave 抛出，弹窗保持打开并显示错误；点击清空错误调用 cleanError。
        </p>
      </div>

      <WorkspaceDialog
        ref={(value) => {
          controller = value;
        }}
        open={saveOpen()}
        onOpenChange={setSaveOpen}
        initialData={initial}
        onSave={async () => {
          throw new Error("保存失败：无法连接服务器。");
        }}
      />
    </div>
  );
}
