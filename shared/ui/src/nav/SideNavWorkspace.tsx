import { For, Show, createSignal, type Component, type JSX } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

/** 工作区下的对话。 */
export interface WorkspaceConversation {
  id: string;
  title: string;
}

/** 工作区（可包含多个对话）。 */
export interface Workspace {
  id: string;
  name: string;
  conversations: WorkspaceConversation[];
}

export interface SideNavWorkspaceProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 工作区列表；为空时显示空状态。 */
  workspaces?: Workspace[];
  /** 当前选中的对话 id。 */
  activeConversationId?: string;
  /** 点击某个工作区下的对话。 */
  onSelectConversation?: (workspaceId: string, conversationId: string) => void;
  /** 点击工作区搜索按钮。 */
  onSearch?: () => void;
  /** 点击新增工作区按钮。 */
  onCreateWorkspace?: () => void;
  /** 点击工作区的「更多」按钮。 */
  onMoreWorkspace?: (workspaceId: string) => void;
  /** 点击工作区的「新建对话」按钮。 */
  onCreateConversation?: (workspaceId: string) => void;
  class?: string;
}

function SearchIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function PlusIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronIcon(props: { expanded: boolean }): JSX.Element {
  return (
    <svg
      class={`h-3.5 w-3.5 shrink-0 transition-transform ${props.expanded ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function MoreIcon(): JSX.Element {
  return (
    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

/** 左侧工作区列表：搜索、新增工作区、折叠展开、对话选择与工作区操作。 */
export const SideNavWorkspace: Component<SideNavWorkspaceProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const [collapsedWorkspaces, setCollapsedWorkspaces] = createSignal<ReadonlySet<string>>(new Set());

  const isCollapsed = (workspaceId: string) => collapsedWorkspaces().has(workspaceId);

  const toggleWorkspace = (workspaceId: string) => {
    setCollapsedWorkspaces((current) => {
      const next = new Set(current);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  };

  return (
    <section class={`mt-2 border-t border-slate-200 pt-2 dark:border-white/10 ${props.class ?? ""}`}>
      <div class="flex items-center justify-between gap-1 px-3 pb-1">
        <p class="m-0 truncate text-[14px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {translate(locale(), "nav.workspaces", "工作区")}
        </p>
        <div class="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => props.onSearch?.()}
            aria-label={translate(locale(), "nav.searchWorkspaces", "搜索工作区")}
            title={translate(locale(), "nav.searchWorkspaces", "搜索工作区")}
            class="grid h-7 w-7 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            onClick={() => props.onCreateWorkspace?.()}
            aria-label={translate(locale(), "nav.createWorkspace", "新增工作区")}
            title={translate(locale(), "nav.createWorkspace", "新增工作区")}
            class="grid h-7 w-7 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <For
        each={props.workspaces ?? []}
        fallback={
          <p class="m-0 px-3 py-1 text-[13px] text-slate-400 dark:text-slate-500">
            {translate(locale(), "nav.emptyWorkspaces", "暂无工作区")}
          </p>
        }
      >
        {(workspace) => (
          <div class="group mb-1">
            <div class="flex h-9 items-center gap-0.5 rounded-lg pl-1 pr-1 transition hover:bg-slate-900/5 dark:hover:bg-white/5">
              <button
                type="button"
                onClick={() => toggleWorkspace(workspace.id)}
                aria-expanded={!isCollapsed(workspace.id)}
                class="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 text-left text-[13px] font-medium text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-300"
              >
                <ChevronIcon expanded={!isCollapsed(workspace.id)} />
                <span class="truncate">{workspace.name}</span>
              </button>
              <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => props.onMoreWorkspace?.(workspace.id)}
                  aria-label={translate(locale(), "nav.moreWorkspace", "更多工作区操作")}
                  title={translate(locale(), "nav.moreWorkspace", "更多工作区操作")}
                  class="grid h-7 w-7 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/10 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <MoreIcon />
                </button>
                <button
                  type="button"
                  onClick={() => props.onCreateConversation?.(workspace.id)}
                  aria-label={translate(locale(), "nav.newConversation", "新建对话")}
                  title={translate(locale(), "nav.newConversation", "新建对话")}
                  class="grid h-7 w-7 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/10 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <PlusIcon />
                </button>
              </div>
            </div>
            <Show when={!isCollapsed(workspace.id)}>
              <div class="flex flex-col gap-1 pt-1">
                <For each={workspace.conversations}>
                  {(conversation) => (
                    <button
                      type="button"
                      onClick={() => props.onSelectConversation?.(workspace.id, conversation.id)}
                      aria-current={props.activeConversationId === conversation.id ? "page" : undefined}
                      class={`flex h-9 w-full items-center gap-2 rounded-lg pl-6 pr-3 text-left text-[13px] outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
                        props.activeConversationId === conversation.id
                          ? "bg-blue-500/15 font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                          : "text-slate-500 hover:bg-slate-900/5 dark:text-slate-400 dark:hover:bg-white/5"
                      }`}
                    >
                      <span class="truncate">{conversation.title}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </For>
    </section>
  );
};
