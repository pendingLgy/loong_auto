import { For, Show } from "solid-js";

import type { MenuCategory, PreviewKey, WorkspaceView } from "../../types";

export interface PreviewNavProps {
  active: PreviewKey;
  category: MenuCategory;
  onActiveChange: (key: PreviewKey) => void;
  onCategoryChange: (key: MenuCategory) => void;
  workspaceView: WorkspaceView;
  onWorkspaceViewChange: (view: WorkspaceView) => void;
}

const categories: Array<{key: MenuCategory; label: string}> = [
  {key: "basic", label: "基础"},
  {key: "default", label: "默认选中"},
  {key: "states", label: "状态"},
  {key: "danger", label: "危险操作"},
  {key: "nested", label: "四级子菜单"},
  {key: "props", label: "参数介绍"},
];

/** 预览左侧组件与场景导航。 */
export function PreviewNav(props: PreviewNavProps) {
  const itemClass = (active: boolean, nested = false) =>
    `flex ${nested ? "h-8 text-[12px]" : "h-9 text-[13px]"} w-full items-center rounded-md px-2.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
      active
        ? "bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
        : `${nested ? "text-slate-500" : "text-slate-600"} hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`
    }`;

  return (
    <aside class="h-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p class="m-0 mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        Components
      </p>
      <nav class="grid gap-0.5">
        <button
          type="button"
          onClick={() => props.onActiveChange("menu")}
          aria-current={props.active === "menu" ? "page" : undefined}
          class={itemClass(props.active === "menu")}
        >
          Menu
        </button>

        <Show when={props.active === "menu"}>
          <div class="ml-3 grid gap-0.5 border-l border-slate-200 pl-2 dark:border-slate-700">
            <For each={categories}>
              {(item) => (
                <button
                  type="button"
                  onClick={() => props.onCategoryChange(item.key)}
                  aria-current={props.category === item.key ? "page" : undefined}
                  class={itemClass(props.category === item.key, true)}
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>
        </Show>

        <button
          type="button"
          onClick={() => props.onActiveChange("workspace")}
          aria-current={props.active === "workspace" ? "page" : undefined}
          class={itemClass(props.active === "workspace")}
        >
          Workspace
        </button>

        <Show when={props.active === "workspace"}>
          <div class="ml-3 grid gap-0.5 border-l border-slate-200 pl-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => props.onWorkspaceViewChange("preview")}
              aria-current={props.workspaceView === "preview" ? "page" : undefined}
              class={itemClass(props.workspaceView === "preview", true)}
            >
              预览
            </button>
            <button
              type="button"
              onClick={() => props.onWorkspaceViewChange("doc")}
              aria-current={props.workspaceView === "doc" ? "page" : undefined}
              class={itemClass(props.workspaceView === "doc", true)}
            >
              使用文档
            </button>
            <button
              type="button"
              onClick={() => props.onWorkspaceViewChange("error")}
              aria-current={props.workspaceView === "error" ? "page" : undefined}
              class={itemClass(props.workspaceView === "error", true)}
            >
              错误提示
            </button>
          </div>
        </Show>

        <button
          type="button"
          onClick={() => props.onActiveChange("theme")}
          aria-current={props.active === "theme" ? "page" : undefined}
          class={itemClass(props.active === "theme")}
        >
          Theme Tokens
        </button>
      </nav>
    </aside>
  );
}
