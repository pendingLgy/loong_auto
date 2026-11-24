import {For, Show, createEffect, createSignal, onMount} from "solid-js";

import {useNavigate, useParams} from "@solidjs/router";
import {createEventListener} from "@solid-primitives/event-listener";
import {
  SESSION_CREATED_EVENT,
  type SessionCreatedEventDetail,
} from "../../events";

import {WorkspaceCreate, type WorkspaceCreateInput} from "@loong/ui/workspace-picker";
import {Dialog} from "@loong/ui/dialog";
import {type LayoutState, ThreePaneLayout} from "@loong/ui/layout";
import {SideNav, type SideNavKey, type SideNavUserData, type Workspace} from "@loong/ui/nav";
import {createApiClient} from "../../api";
import {isChatStreaming, startChatExecutor} from "../../chat/executor";
import {showNotice} from "../../storage/app_notice";
import {getWorkspaceState, saveWorkspaceState} from "../../storage/workspace";
import {saveSessionConfig} from "../../storage/session_config";
import {useWorkspaceLocalData} from "./workspace_context";
import {workspaceTabKey, type WorkspaceChatTab} from "./types";
import {ChatPage} from "./ChatPage";

import {Effect} from "effect";

function createSessionId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface WorkspaceViewProps {
  /** 组件高度，默认 100%。 */
  height?: number | string;
  /** HomeTabs 中的工作区 / 会话标签。 */
  tabs?: WorkspaceChatTab[];
  /** 当前激活标签 key。 */
  activeTabKey?: string;
  /** 打开工作区会话标签。 */
  onOpenConversation?: (tab: WorkspaceChatTab) => void;
  /** 变化时请求新建对话。 */
  newChatToken?: number;
  /** 点击标签时展开对应工作区。 */
  workspaceExpandToken?: number;
}

/** 服务器工作区：左中右布局，界面状态保存到 storage/workspace.ts。 */
export function WorkspaceView(props: WorkspaceViewProps) {
  const navigate = useNavigate();
  const params = useParams();
  const localData = useWorkspaceLocalData();
  const initial = localData.initial;
  const [layout, setLayout] = createSignal<LayoutState>(initial.layout);
  const [active, setActive] = createSignal<SideNavKey>(initial.active);
  const [workspaces, setWorkspaces] = createSignal<Workspace[]>(initial.workspaces);
  const [activeConversationId, setActiveConversationId] = createSignal(
    initial.activeConversationId,
  );
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = createSignal(false);
  const [editWorkspace, setEditWorkspace] = createSignal<Workspace | null>(null);
  const [editWorkspaceName, setEditWorkspaceName] = createSignal("");
  const [editWorkspaceSaving, setEditWorkspaceSaving] = createSignal(false);
  const [removeWorkspaceTarget, setRemoveWorkspaceTarget] = createSignal<Workspace | null>(null);
  const [removeWorkspaceSaving, setRemoveWorkspaceSaving] = createSignal(false);
  const NARROW_LAYOUT_WIDTH = 1024;
  const [narrowLayout, setNarrowLayout] = createSignal(
    typeof window !== "undefined" && window.innerWidth < NARROW_LAYOUT_WIDTH,
  );
  let layoutBeforeNarrow: LayoutState | null = null;

  createEffect(() => {
    if (narrowLayout()) {
      if (!layoutBeforeNarrow) {
        layoutBeforeNarrow = layout();
        setLayout((current) => ({
          ...current,
          leftCollapsed: true,
          rightCollapsed: true,
        }));
      }
      return;
    }
    if (layoutBeforeNarrow) {
      const previous = layoutBeforeNarrow;
      layoutBeforeNarrow = null;
      setLayout((current) => ({
        ...current,
        leftCollapsed: previous.leftCollapsed,
        rightCollapsed: previous.rightCollapsed,
      }));
    }
  });

  createEventListener(window, "resize", () => {
    setNarrowLayout(window.innerWidth < NARROW_LAYOUT_WIDTH);
  });

  createEffect(() => {
    saveWorkspaceState({
      layout: layout(),
      active: active(),
      workspaces: workspaces(),
      activeConversationId: activeConversationId(),
      selectedModel: initial.selectedModel,
      selectedProvider: initial.selectedProvider,
    });
  });

  const currentServer = () => localData.serverConfig();

  const api = () => createApiClient();

  const loadWorkspaces = async () => {
    try {
      const client = api();
      const page = await Effect.runPromise(
        client.workspace.list({page: 1, pageSize: 100}),
      );
      const stored = getWorkspaceState();
      const storedConversations = new Map(
        stored.workspaces.map((workspace) => [workspace.id, workspace.conversations]),
      );

      const rows = await Promise.all(page.rows.map(async (workspace) => {
        const localConversations = storedConversations.get(workspace.id) ?? [];
        let conversations = localConversations;

        try {
          const sessions = await Effect.runPromise(client.session.list({
            workspaceId: workspace.id,
            page: 1,
            pageSize: 100,
          }));
          // 刷新后以云端会话为准，覆盖本地缓存。
          conversations = sessions.rows.map((session) => ({
            id: session.sessionId,
            title: session.sessionTitle?.trim() || "新的对话",
          }));
        } catch {
          // 查询失败时才保留本地缓存，避免网络异常导致对话全部消失。
        }

        return {
          id: workspace.id,
          name: workspace.name?.trim() || workspace.path[0] || "未命名工作区",
          path: workspace.path,
          conversations,
        };
      }));

      setWorkspaces(rows);
      if (!rows.some((workspace) => workspace.conversations.some(
        (conversation) => conversation.id === activeConversationId(),
      ))) {
        setActiveConversationId("");
      }
    } catch {
      showNotice("error", "获取工作区列表失败");
    }
  };

  onMount(() => {
    void loadWorkspaces();
    startChatExecutor();

    const onSessionCreated = (event: Event) => {
      const detail = (event as CustomEvent<SessionCreatedEventDetail>).detail;
      if (!detail?.workspaceId || !detail.sessionId || !detail.title) return;
      setWorkspaces((list) => list.map((workspace) => {
        const conversations = workspace.conversations.filter(
          (conversation) => conversation.id !== detail.sessionId,
        );
        return workspace.id === detail.workspaceId
          ? {
            ...workspace,
            conversations: [...conversations, {
              id: detail.sessionId!,
              title: detail.title!,
            }],
          }
          : {...workspace, conversations};
      }));
    };
    createEventListener(window, SESSION_CREATED_EVENT, onSessionCreated);
  });

  const userData = (): SideNavUserData | undefined => {
    const info = localData.currentUser();
    return info ? {name: info.name ?? info.username, username: info.username} : undefined;
  };

  const pickWorkspaceDirectory = async (): Promise<string | null> => {
    const picker = (window as Window & {
      showDirectoryPicker?: () => Promise<{name: string}>;
    }).showDirectoryPicker;
    if (!picker) {
      throw new Error("当前环境不支持文件夹选择，请手动输入目录路径");
    }
    const directory = await picker();
    return directory.name;
  };

  const openEditWorkspace = (workspaceId: string) => {
    const workspace = workspaces().find((item) => item.id === workspaceId);
    if (!workspace) return;
    setEditWorkspace(workspace);
    setEditWorkspaceName(workspace.name);
  };

  const openRemoveWorkspace = (workspaceId: string) => {
    const workspace = workspaces().find((item) => item.id === workspaceId);
    if (workspace) setRemoveWorkspaceTarget(workspace);
  };

  const removeWorkspace = async () => {
    const target = removeWorkspaceTarget();
    if (!target || removeWorkspaceSaving()) return;

    setRemoveWorkspaceSaving(true);
    try {
      await Effect.runPromise(api().workspace.delete(target.id));
      setWorkspaces((list) => list.filter((workspace) => workspace.id !== target.id));
      if (target.conversations.some(
        (conversation) => conversation.id === activeConversationId(),
      )) {
        setActiveConversationId("");
        navigate("/");
      }
      setRemoveWorkspaceTarget(null);
    } catch {
      showNotice("error", "移除工作区失败");
    } finally {
      setRemoveWorkspaceSaving(false);
    }
  };

  const saveWorkspaceName = async () => {
    const target = editWorkspace();
    const name = editWorkspaceName().trim();
    if (!target || !name || editWorkspaceSaving()) return;

    setEditWorkspaceSaving(true);
    try {
      await Effect.runPromise(api().workspace.update(target.id, {
        name,
        path: target.path?.length ? target.path : [name],
      }));
      setWorkspaces((list) => list.map((workspace) =>
        workspace.id === target.id ? {...workspace, name} : workspace));
      setEditWorkspace(null);
    } catch {
      showNotice("error", "修改工作区失败");
    } finally {
      setEditWorkspaceSaving(false);
    }
  };

  const openWorkspaceCreate = () => {
    setWorkspaceCreateOpen(true);
  };

  const closeWorkspaceCreate = () => {
    setWorkspaceCreateOpen(false);
  };

  const createWorkspaceFromPicker = async (input: WorkspaceCreateInput) => {
    const workspace = await Effect.runPromise(api().workspace.create({
      name: input.name,
      path: input.path,
    }));
    setWorkspaces((list) => [
      ...list,
      {id: workspace.id, name: workspace.name ?? input.name, path: input.path, conversations: []},
    ]);
    closeWorkspaceCreate();
  };

  const openConversationTab = (workspaceId: string, conversationId: string) => {
    const workspace = workspaces().find((item) => item.id === workspaceId);
    const conversation = workspace?.conversations.find((item) => item.id === conversationId);
    if (!workspace || !conversation || !props.onOpenConversation) return;
    props.onOpenConversation({
      key: workspaceTabKey(workspaceId, conversationId),
      label: `${workspace.name} / ${conversation.title}`,
      workspaceId,
      workspaceName: workspace.name,
      conversationId,
      conversationTitle: conversation.title,
    });
  };

  const addConversation = (workspaceId: string) => {
    const id = createSessionId();
    const title = "新的对话";
    saveSessionConfig(id, {pending: true, workspaceId});
    setWorkspaces((list) =>
      list.map((workspace) =>
        workspace.id === workspaceId
          ? {...workspace, conversations: [...workspace.conversations, {id, title}]}
          : workspace,
      ),
    );
    setActiveConversationId(id);
    setActive("newChat");
    openConversationTab(workspaceId, id);
    navigate(`/chat/${id}`);
  };

  createEffect(() => {
    const sessionId = params.sessionId;
    if (sessionId && sessionId !== activeConversationId()) {
      setActiveConversationId(sessionId);
    }
  });

  createEffect(() => {
    const key = props.activeTabKey;
    if (!key) {
      setActiveConversationId("");
      return;
    }
    const tab = props.tabs?.find((item) => item.key === key);
    if (!tab) {
      setActiveConversationId("");
      return;
    }
    if (tab.conversationId !== activeConversationId()) {
      setActiveConversationId(tab.conversationId);
      setActive("newChat");
    }
  });

  const newChat = () => {
    const id = createSessionId();
    const title = "新的对话";
    saveSessionConfig(id, {pending: true});
    setActiveConversationId(id);
    setActive("newChat");
    props.onOpenConversation?.({
      key: workspaceTabKey("unassigned", id),
      label: title,
      workspaceId: "unassigned",
      workspaceName: "",
      conversationId: id,
      conversationTitle: title,
    });
    navigate(`/chat/${id}`);
  };

  let lastNewChatToken = props.newChatToken;
  createEffect(() => {
    const token = props.newChatToken;
    if (token === undefined || token === lastNewChatToken) return;
    lastNewChatToken = token;
    newChat();
  });

  const onLayoutChange = (next: LayoutState) => {
    setLayout(next);
  };

  return (
    <>
      <ThreePaneLayout
        value={layout()}
        onChange={onLayoutChange}
        minLeftWidth={260}
        minRightWidth={300}
        height={props.height ?? "100%"}
        left={
          <SideNav
            height="100%"
            minHeight={0}
            active={active()}
            onSelect={setActive}
            onNewChat={newChat}
            onAutomation={() => {
              setActive("automation");
              navigate("/");
            }}
            workspaces={workspaces()}
            activeConversationId={activeConversationId()}
            onSelectConversation={(workspaceId, conversationId) => {
              saveSessionConfig(conversationId, {workspaceId});
              setActiveConversationId(conversationId);
              openConversationTab(workspaceId, conversationId);
              navigate(`/chat/${conversationId}`);
            }}
            onSearch={() => undefined}
            onCreateWorkspace={openWorkspaceCreate}
            onEditWorkspace={openEditWorkspace}
            onRemoveWorkspace={openRemoveWorkspace}
            onCreateConversation={addConversation}
            isConversationProcessing={(_, conversationId) => isChatStreaming(conversationId)}
            user={userData()}
            onUserClick={() => undefined}
            onSettings={() => navigate("/settings")}
          />
        }
        right={
          <div class="grid gap-2 p-3">
            <h2 class="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">详情</h2>
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
              服务器：{currentServer()?.serverUrl ?? "未配置"}
            </p>
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
              选中左侧条目后，这里展示对应的工具与审批信息。
            </p>
          </div>
        }
      >
        <Show when={activeConversationId()}>
          <For each={[activeConversationId()]}>
            {(sessionId) => (
              <ChatPage
                sessionId={sessionId}
                onWorkspaceCreated={() => void loadWorkspaces()}
              />
            )}
          </For>
        </Show>
      </ThreePaneLayout>

      <WorkspaceCreate
        open={workspaceCreateOpen()}
        onSubmit={createWorkspaceFromPicker}
        onPickDirectory={pickWorkspaceDirectory}
        onClose={closeWorkspaceCreate}
      />

      <Dialog
        open={editWorkspace() !== null}
        onClose={() => {
          if (!editWorkspaceSaving()) setEditWorkspace(null);
        }}
        size="sm"
        header={
          <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
            编辑工作区
          </h2>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditWorkspace(null)}
              disabled={editWorkspaceSaving()}
              class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void saveWorkspaceName()}
              disabled={editWorkspaceSaving() || !editWorkspaceName().trim()}
              class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
            >
              {editWorkspaceSaving() ? "保存中…" : "保存"}
            </button>
          </>
        }
      >
        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">工作区名称</span>
          <input
            value={editWorkspaceName()}
            onInput={(event) => setEditWorkspaceName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveWorkspaceName();
            }}
            maxlength={256}
            autofocus
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100"
          />
        </label>
        <div class="mt-4 grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">工作区目录</span>
          <Show
            when={(editWorkspace()?.path?.length ?? 0) > 0}
            fallback={
              <p class="m-0 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[13px] text-slate-400 dark:border-white/10 dark:text-slate-500">
                未配置工作目录
              </p>
            }
          >
            <ul class="m-0 grid w-full min-w-0 list-none gap-1 p-0">
              <For each={editWorkspace()?.path ?? []}>
                {(item) => (
                  <li
                    title={item}
                    class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                  >
                    {item}
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </Dialog>

      <Dialog
        open={removeWorkspaceTarget() !== null}
        onClose={() => {
          if (!removeWorkspaceSaving()) setRemoveWorkspaceTarget(null);
        }}
        size="sm"
        header={
          <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
            移除工作区
          </h2>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setRemoveWorkspaceTarget(null)}
              disabled={removeWorkspaceSaving()}
              class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void removeWorkspace()}
              disabled={removeWorkspaceSaving()}
              class="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-progress disabled:opacity-70"
            >
              {removeWorkspaceSaving() ? "移除中…" : "移除"}
            </button>
          </>
        }
      >
        <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
          确定移除工作区「{removeWorkspaceTarget()?.name}」？此操作不可撤销。
        </p>
      </Dialog>
    </>
  );
}
