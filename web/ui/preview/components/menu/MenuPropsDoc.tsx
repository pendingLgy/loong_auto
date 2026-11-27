import { For } from "solid-js";

interface PropRow {
  name: string;
  type: string;
  defaultValue?: string;
  description: string;
}

const menuProps: PropRow[] = [
  {name: "items", type: "MenuItem[]", description: "菜单数据，支持嵌套 children。"},
  {name: "value", type: "string", description: "当前选中项 key。"},
  {name: "onSelect", type: "(key: string) => void", description: "点击叶子菜单项时触发。"},
  {name: "defaultExpandedKeys", type: "string[]", defaultValue: "[]", description: "非受控模式的默认展开项。"},
  {name: "expandedKeys", type: "string[]", description: "受控展开项，传入后由外部维护。"},
  {name: "onExpandedChange", type: "(keys: string[]) => void", description: "展开状态变化时触发。"},
  {name: "width", type: "string | number", description: "菜单宽度，数字按 px 处理。"},
  {name: "height", type: "string | number", description: "菜单整体高度，数字按 px 处理。"},
  {name: "class", type: "string", description: "追加到菜单容器的 Tailwind 类。"},
];

const itemProps: PropRow[] = [
  {name: "key", type: "string", description: "菜单项唯一标识。"},
  {name: "label", type: "string", description: "菜单项文本。"},
  {name: "icon", type: "JSX.Element", description: "左侧图标。"},
  {name: "slot", type: "JSX.Element", description: "自定义内容，优先于 label。"},
  {name: "disabled", type: "boolean", defaultValue: "false", description: "是否禁用。"},
  {name: "children", type: "MenuItem[]", description: "子菜单，支持多级嵌套。"},
  {name: "itemClass", type: "string", description: "追加到菜单项按钮的 Tailwind 类。"},
];

const usage = `const [value, setValue] = createSignal("profile");

const items = [
  {key: "profile", label: "个人信息"},
  {
    key: "settings",
    label: "设置",
    children: [
      {key: "general", label: "通用"},
      {key: "advanced", label: "高级"},
    ],
  },
];

<Menu
  items={items}
  value={value()}
  onSelect={setValue}
  defaultExpandedKeys={["settings"]}
  width={224}
  height={240}
/>`;

const controlledUsage = `const [expandedKeys, setExpandedKeys] = createSignal(["settings"]);

<Menu
  items={items}
  expandedKeys={expandedKeys()}
  onExpandedChange={setExpandedKeys}
  value={value()}
  onSelect={setValue}
/>`;

const customUsage = `const items = [
  {
    key: "delete",
    label: "删除",
    itemClass: "text-red-600 hover:bg-red-50",
  },
];`;

const slotUsage = `const items = [
  {
    key: "notice",
    slot: (
      <span class="flex w-full items-center justify-between">
        通知
        <span class="rounded-full bg-indigo-100 px-1.5 text-[10px]">
          3
        </span>
      </span>
    ),
  },
];`;

function CodeBlock(props: {title: string; code: string}) {
  return (
    <div class="grid gap-2">
      <h3 class="m-0 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
        {props.title}
      </h3>
      <pre class="m-0 overflow-x-auto rounded-md bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
{props.code}
      </pre>
    </div>
  );
}

function PropTable(props: {title: string; rows: PropRow[]}) {
  return (
    <div class="grid gap-2">
      <h3 class="m-0 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
        {props.title}
      </h3>
      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table class="w-full border-collapse text-left text-[12px]">
          <thead class="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th class="px-3 py-2 font-medium">参数</th>
              <th class="px-3 py-2 font-medium">类型</th>
              <th class="px-3 py-2 font-medium">默认值</th>
              <th class="px-3 py-2 font-medium">说明</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.rows}>
              {(row) => (
                <tr class="border-t border-slate-200 dark:border-slate-700">
                  <td class="px-3 py-2 font-mono text-indigo-600 dark:text-indigo-300">
                    {row.name}
                  </td>
                  <td class="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                    {row.type}
                  </td>
                  <td class="px-3 py-2 font-mono text-slate-400 dark:text-slate-500">
                    {row.defaultValue ?? "-"}
                  </td>
                  <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                    {row.description}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Menu 组件参数说明。 */
export function MenuPropsDoc() {
  return (
    <div class="grid gap-5">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          Menu 使用文档
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          Menu 与 MenuItem 的参数与使用说明。
        </p>
      </div>
      <PropTable title="MenuProps" rows={menuProps} />
      <PropTable title="MenuItem" rows={itemProps} />
      <CodeBlock title="基础用法" code={usage} />
      <CodeBlock title="受控展开" code={controlledUsage} />
      <CodeBlock title="自定义样式" code={customUsage} />
      <CodeBlock title="自定义插槽" code={slotUsage} />
    </div>
  );
}
