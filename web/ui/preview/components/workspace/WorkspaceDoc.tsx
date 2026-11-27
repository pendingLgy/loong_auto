import { For } from "solid-js";

interface PropRow {
  name: string;
  type: string;
  description: string;
}

const props: PropRow[] = [
  {name: "open", type: "boolean", description: "是否打开弹窗。"},
  {name: "onOpenChange", type: "(open: boolean) => void", description: "弹窗开关状态变化时触发。"},
  {name: "initialData", type: "WorkspaceSaveData", description: "打开时用于初始化名称和路径列表。"},
  {name: "onInit", type: "(data: WorkspaceSaveData) => void", description: "打开并完成数据初始化后触发。"},
  {name: "onCancel", type: "() => void", description: "点击取消或关闭按钮时触发。"},
  {name: "onSave", type: "(data: WorkspaceSaveData) => boolean | void | Promise<boolean | void>", description: "点击保存时触发；返回 false 或 Promise reject 时保持弹窗打开。"},
  {name: "nameMaxLength", type: "number", description: "工作区名称最大长度，默认 30。"},
  {name: "ref", type: "(controller: WorkspaceDialogController) => void", description: "获取控制器，调用 cleanError 清空错误。"},
  {name: "labels", type: "Partial<WorkspaceDialogLabels>", description: "覆盖内置文案。"},
];

const usage = `const [open, setOpen] = createSignal(false);
let dialog: WorkspaceDialogController | undefined;

<WorkspaceDialog
  ref={(value) => {
    dialog = value;
  }}
  open={open()}
  onOpenChange={setOpen}
  initialData={{name: "Loong", paths: ["D:\\\\workspace"]}}
  onInit={(data) => console.log("init", data)}
  onCancel={() => console.log("cancel")}
  onSave={async (data) => {
    await saveWorkspace(data);
    setOpen(false);
  }}
/>`;

/** 工作区组件使用文档。 */
export function WorkspaceDoc() {
  return (
    <div class="grid gap-5">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          WorkspaceDialog
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          工作区名称、目录选择、必填校验、列表编辑与事件回调。
        </p>
      </div>

      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="w-full border-collapse text-left text-[12px]">
          <thead class="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th class="px-3 py-2 font-medium">参数</th>
              <th class="px-3 py-2 font-medium">类型</th>
              <th class="px-3 py-2 font-medium">说明</th>
            </tr>
          </thead>
          <tbody>
            <For each={props}>
              {(row) => (
                <tr class="border-t border-slate-200 dark:border-slate-700">
                  <td class="px-3 py-2 font-mono text-indigo-600 dark:text-indigo-300">{row.name}</td>
                  <td class="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">{row.type}</td>
                  <td class="px-3 py-2 text-slate-500 dark:text-slate-400">{row.description}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <div class="grid gap-2">
        <h3 class="m-0 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          WorkspaceSaveData
        </h3>
        <pre class="m-0 overflow-x-auto rounded-md bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
{`interface WorkspaceSaveData {
  name: string;
  paths: string[];
}`}
        </pre>
      </div>

      <div class="grid gap-2">
        <h3 class="m-0 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          使用示例
        </h3>
        <pre class="m-0 overflow-x-auto rounded-md bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
{usage}
        </pre>
      </div>

      <div class="grid gap-2 rounded-lg border border-slate-200 p-4 text-[12px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <p class="m-0 font-medium text-slate-600 dark:text-slate-300">必填校验</p>
        <p class="m-0">工作区名称必填，默认最多 30 个字符，可通过 nameMaxLength 调整。</p>
        <p class="m-0">至少选择一个工作区；字段错误显示在对应输入框或列表标题下方，并预留高度避免布局跳动。</p>
      </div>

      <div class="grid gap-2 rounded-lg border border-slate-200 p-4 text-[12px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <p class="m-0 font-medium text-slate-600 dark:text-slate-300">错误提示</p>
        <p class="m-0">onSave 返回的 Promise 失败时，弹窗保持打开并显示错误消息。</p>
        <p class="m-0">通过 ref 获取 WorkspaceDialogController，调用 cleanError() 手动清空错误。</p>
      </div>

      <div class="grid gap-2 rounded-lg border border-slate-200 p-4 text-[12px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <p class="m-0 font-medium text-slate-600 dark:text-slate-300">事件顺序</p>
        <p class="m-0">打开弹窗 → onInit → 编辑 → 校验 → onSave 或 onCancel。</p>
      </div>
    </div>
  );
}
