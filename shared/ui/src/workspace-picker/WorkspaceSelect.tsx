import { For, Show, type Component } from "solid-js";

import { Dialog } from "../dialog";
import { CheckIcon, PlusIcon } from "../icon";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

/** 工作区选择项。 */
export interface WorkspaceSelectItem {
  id: string;
  name: string;
}

export interface WorkspaceSelectProps {
  /** 是否打开弹窗。 */
  open: boolean;
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 可选工作区列表。 */
  workspaces?: WorkspaceSelectItem[];
  /** 当前会话所属工作区。 */
  activeWorkspaceId?: string;
  /** 选择已有工作区。 */
  onSelect?: (workspaceId: string) => void;
  /** 切换到新建工作区。 */
  onCreate?: () => void;
  /** 关闭弹窗。 */
  onClose?: () => void;
}

/** 选择已有工作区的弹窗。 */
export const WorkspaceSelect: Component<WorkspaceSelectProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;

  return (
    <Dialog
      open={props.open}
      onClose={() => props.onClose?.()}
      size="sm"
      header={
        <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
          {translate(locale(), "workspacePicker.title", "选择工作区")}
        </h2>
      }
    >
      <div class="grid gap-2">
        <Show when={props.onCreate}>
          <button
            type="button"
            onClick={() => props.onCreate?.()}
            class="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-left text-sm text-slate-600 outline-none transition hover:border-sky-400 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-white/15 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:bg-sky-500/10"
          >
            <PlusIcon class="h-4 w-4 shrink-0" />
            <span>{translate(locale(), "workspacePicker.create", "新建工作区")}</span>
          </button>
        </Show>

        <Show
          when={(props.workspaces?.length ?? 0) > 0}
          fallback={
            <p class="m-0 rounded-xl border border-slate-200 px-3 py-4 text-center text-sm text-slate-400 dark:border-white/10 dark:text-slate-500">
              {translate(locale(), "workspacePicker.empty", "暂无工作区")}
            </p>
          }
        >
          <For each={props.workspaces ?? []}>
            {(workspace) => {
              const active = () => workspace.id === props.activeWorkspaceId;
              return (
                <button
                  type="button"
                  onClick={() => props.onSelect?.(workspace.id)}
                  aria-current={active() ? "true" : undefined}
                  class={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
                    active()
                      ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200"
                      : "border-slate-200 text-slate-700 hover:bg-slate-900/5 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                  }`}
                >
                  <span class="min-w-0 flex-1 truncate">{workspace.name}</span>
                  <Show when={active()}>
                    <CheckIcon class="h-4 w-4 shrink-0" />
                  </Show>
                </button>
              );
            }}
          </For>
        </Show>
      </div>
    </Dialog>
  );
};
