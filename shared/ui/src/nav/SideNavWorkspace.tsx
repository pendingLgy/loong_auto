import { For, Show, createEffect, createSignal, onCleanup, onMount, type Component, type JSX } from "solid-js";

import { ChevronIcon, EditIcon, MoreIcon, PlusIcon, SearchIcon, SpinnerIcon } from "../icon";
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
  /** 工作区目录列表。 */
  path?: string[];
  conversations: WorkspaceConversation[];
}

/** 供其他组件触发的命令式方法。 */
export interface SideNavWorkspaceRef {
  /** 刷新工作区列表。 */
  refreshWorkspaces: () => void;
  /** 刷新指定工作区的对话记录。 */
  refreshConversations: (workspaceId: string) => void;
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
  /** 点击工作区的「编辑」。 */
  onEditWorkspace?: (workspaceId: string) => void;
  /** 点击工作区的「移除」。 */
  onRemoveWorkspace?: (workspaceId: string) => void;
  /** 点击工作区的「新建对话」按钮。 */
  onCreateConversation?: (workspaceId: string) => void;
  /** 点击会话的编辑按钮。 */
  onEditConversation?: (workspaceId: string, conversation: WorkspaceConversation) => void;
  /** 刷新工作区列表。 */
  onRefreshWorkspaces?: () => void;
  /** 刷新指定工作区的对话记录。 */
  onRefreshConversations?: (workspaceId: string) => void;
  /**
   * 标记对话是否正在处理中；返回 true 时在对话右侧显示 loading 图标。
   */
  isConversationProcessing?: (workspaceId: string, conversationId: string) => boolean;
  /** 点击标签时展开对应工作区。 */
  expandToken?: number;
  /** 组件就绪后回传命令式方法，供其他组件触发刷新。 */
  onReady?: (ref: SideNavWorkspaceRef) => void;
  class?: string;
}






/** 左侧工作区列表：搜索、新增工作区、折叠展开、对话选择与工作区操作。 */
export const SideNavWorkspace: Component<SideNavWorkspaceProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const [collapsedWorkspaces, setCollapsedWorkspaces] = createSignal<ReadonlySet<string>>(
    new Set(),
  );
  const [menuWorkspaceId, setMenuWorkspaceId] = createSignal("");
  onMount(() => {
    props.onReady?.({
      refreshWorkspaces: () => props.onRefreshWorkspaces?.(),
      refreshConversations: (workspaceId) => props.onRefreshConversations?.(workspaceId),
    });

    const closeMenu = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-workspace-menu]")) setMenuWorkspaceId("");
    };
    document.addEventListener("pointerdown", closeMenu);
    onCleanup(() => document.removeEventListener("pointerdown", closeMenu));
  });

  let collapsedInitialized = false;
  createEffect(() => {
    const list = props.workspaces ?? [];
    if (collapsedInitialized || list.length === 0) return;
    collapsedInitialized = true;
    const activeWorkspaceId = list.find((workspace) =>
      workspace.conversations.some(
        (conversation) => conversation.id === props.activeConversationId,
      ))?.id;
    setCollapsedWorkspaces(new Set(
      list
        .filter((workspace) => workspace.id !== activeWorkspaceId)
        .map((workspace) => workspace.id),
    ));
  });

  let lastExpandToken = props.expandToken;
  createEffect(() => {
    const token = props.expandToken;
    if (token === undefined || token === lastExpandToken) return;
    lastExpandToken = token;
    const activeWorkspaceId = (props.workspaces ?? []).find((workspace) =>
      workspace.conversations.some(
        (conversation) => conversation.id === props.activeConversationId,
      ))?.id;
    if (!activeWorkspaceId) return;

    setCollapsedWorkspaces((current) => {
      if (!current.has(activeWorkspaceId)) return current;
      const next = new Set(current);
      next.delete(activeWorkspaceId);
      return next;
    });
  });

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
    <section class={`mt-2 flex min-h-0 flex-1 flex-col border-t border-slate-200 pt-2 dark:border-white/10 ${props.class ?? ""}`}>
      <div class="flex shrink-0 items-center justify-between gap-1 px-3 pb-1">
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

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
            <div data-workspace-menu class="relative flex h-9 items-center gap-0.5 rounded-lg pl-1 pr-1 transition hover:bg-slate-900/5 dark:hover:bg-white/5">
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
                  onClick={() => setMenuWorkspaceId((current) =>
                    current === workspace.id ? "" : workspace.id)}
                  aria-haspopup="menu"
                  aria-expanded={menuWorkspaceId() === workspace.id}
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

              <Show when={menuWorkspaceId() === workspace.id}>
                <div
                  role="menu"
                  class="absolute right-1 top-9 z-20 grid w-28 gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuWorkspaceId("");
                      props.onEditWorkspace?.(workspace.id);
                    }}
                    class="rounded-md px-2 py-1.5 text-left text-[13px] text-slate-600 outline-none transition hover:bg-slate-900/5 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    {translate(locale(), "nav.editWorkspace", "编辑")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuWorkspaceId("");
                      props.onRemoveWorkspace?.(workspace.id);
                    }}
                    class="rounded-md px-2 py-1.5 text-left text-[13px] text-red-600 outline-none transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    {translate(locale(), "nav.removeWorkspace", "移除")}
                  </button>
                </div>
              </Show>
            </div>
            <Show when={!isCollapsed(workspace.id)}>
              <div class="flex max-h-[300px] flex-col gap-1 overflow-y-auto overscroll-contain pt-1">
                <For each={workspace.conversations}>
                  {(conversation) => (
                    <div
                      class={`group/conversation flex h-9 w-full shrink-0 items-center rounded-lg transition ${
                        props.activeConversationId === conversation.id
                          ? "bg-blue-500/15 dark:bg-blue-500/20"
                          : "hover:bg-slate-900/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCollapsedWorkspaces((current) => {
                            if (!current.has(workspace.id)) return current;
                            const next = new Set(current);
                            next.delete(workspace.id);
                            return next;
                          });
                          props.onSelectConversation?.(workspace.id, conversation.id);
                        }}
                        aria-current={props.activeConversationId === conversation.id ? "page" : undefined}
                        class={`flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pl-6 pr-2 text-left text-[13px] outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
                          props.activeConversationId === conversation.id
                            ? "font-medium text-blue-700 dark:text-blue-200"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <span class="min-w-0 flex-1 truncate">{conversation.title}</span>
                        <Show when={props.isConversationProcessing?.(workspace.id, conversation.id)}>
                          <span
                            class="grid h-4 w-4 shrink-0 place-items-center text-blue-600 dark:text-blue-400"
                            role="status"
                            aria-label={translate(locale(), "nav.processing", "处理中")}
                            title={translate(locale(), "nav.processing", "处理中")}
                          >
                            <SpinnerIcon />
                          </span>
                        </Show>
                      </button>
                      <Show when={props.onEditConversation}>
                        <button
                          type="button"
                          onClick={() => props.onEditConversation?.(workspace.id, conversation)}
                          aria-label={translate(locale(), "nav.editConversation", "编辑会话")}
                          title={translate(locale(), "nav.editConversation", "编辑会话")}
                          class="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded text-slate-500 opacity-0 outline-none transition hover:bg-slate-900/10 hover:text-slate-700 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sky-500/40 group-hover/conversation:opacity-100 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                        >
                          <EditIcon class="h-3.5 w-3.5" />
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </For>
      </div>
    </section>
  );
};
