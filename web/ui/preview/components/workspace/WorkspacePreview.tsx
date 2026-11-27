import { createSignal } from "solid-js";

import { WorkspaceDialog, type WorkspaceSaveData } from "../../../src";

const initial: WorkspaceSaveData = {
  name: "Loong Workspace",
  paths: ["F:\\workspace\\loong_auto", "/home/user/project"],
};

/** 工作区弹窗预览：初始化、取消与保存事件。 */
export function WorkspacePreview() {
  const [open, setOpen] = createSignal(false);
  const [initialized, setInitialized] = createSignal<string>("未初始化");
  const [saved, setSaved] = createSignal<string>("尚未保存");
  const [cancelled, setCancelled] = createSignal(0);

  return (
    <div class="grid gap-5">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          Workspace
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          工作区弹窗：名称、文件夹选择、列表编辑与保存。
        </p>
      </div>

      <div class="grid gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setOpen(true)}
          class="inline-flex h-9 w-fit items-center rounded-md bg-indigo-500 px-3 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          打开工作区弹窗
        </button>

        <div class="grid gap-2 text-[12px] text-slate-500 dark:text-slate-400">
          <p class="m-0">
            <span class="font-medium text-slate-600 dark:text-slate-300">初始化：</span>
            {initialized()}
          </p>
          <p class="m-0">
            <span class="font-medium text-slate-600 dark:text-slate-300">保存：</span>
            {saved()}
          </p>
          <p class="m-0">
            <span class="font-medium text-slate-600 dark:text-slate-300">取消次数：</span>
            {cancelled()}
          </p>
        </div>
      </div>

      <div class="grid gap-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <p class="m-0 text-[12px] font-medium text-slate-600 dark:text-slate-300">
          初始数据
        </p>
        <pre class="m-0 overflow-x-auto rounded-md bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
{JSON.stringify(initial, null, 2)}
        </pre>
      </div>

      <WorkspaceDialog
        open={open()}
        onOpenChange={setOpen}
        initialData={initial}
        onInit={(data) => setInitialized(JSON.stringify(data))}
        onCancel={() => setCancelled((count) => count + 1)}
        onSave={(data) => {
          setSaved(JSON.stringify(data));
          setOpen(false);
        }}
      />
    </div>
  );
}
