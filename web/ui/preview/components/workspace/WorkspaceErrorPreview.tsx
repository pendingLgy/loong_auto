import { createSignal } from "solid-js";

import { WorkspaceDialog, type WorkspaceSaveData } from "../../../src";

const initial: WorkspaceSaveData = {
  name: "Demo",
  paths: ["D:\\workspace\\demo"],
};

/** 工作区错误提示预览。 */
export function WorkspaceErrorPreview() {
  const [externalOpen, setExternalOpen] = createSignal(false);
  const [saveOpen, setSaveOpen] = createSignal(false);

  return (
    <div class="grid gap-5">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          错误提示
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          外部错误与保存回调失败时的提示效果。
        </p>
      </div>

      <div class="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExternalOpen(true)}
            class="inline-flex h-9 items-center rounded-md bg-indigo-500 px-3 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            打开外部错误
          </button>
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            class="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-[13px] font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            模拟保存失败
          </button>
        </div>
        <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
          外部错误通过 error 传入；保存失败由 onSave 抛出，弹窗保持打开并显示错误。
        </p>
      </div>

      <WorkspaceDialog
        open={externalOpen()}
        onOpenChange={setExternalOpen}
        initialData={initial}
        error="工作区保存失败：没有权限写入该目录。"
        onSave={() => {
          setExternalOpen(false);
        }}
      />

      <WorkspaceDialog
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
