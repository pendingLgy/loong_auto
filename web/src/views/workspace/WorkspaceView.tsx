import {For, Show, createEffect, createSignal, onCleanup, onMount} from "solid-js";

import {useNavigate} from "@solidjs/router";

import type {MessageRecord} from "@loong/client";

import {LlmChat, type ChatModelGroup} from "@loong/ui/chat";
import {Dialog} from "@loong/ui/dialog";
import {EditIcon, PlusIcon, TrashIcon} from "@loong/ui/icon";
import {WorkspaceCreate, WorkspaceSelect, type WorkspaceCreateInput} from "@loong/ui/workspace-picker";
import type {ManagedModel, ManagedProvider, ProviderOption} from "@loong/ui/model-picker";
import {type LayoutState, ThreePaneLayout} from "@loong/ui/layout";
import {SideNav, type SideNavKey, type SideNavUserData, type Workspace} from "@loong/ui/nav";
import {createApiClient} from "../../api";
import {enqueueChatMessage, isChatStreaming, startChatExecutor} from "../../chat/executor";
import {MessageStatus} from "../../chat/status";
import {showNotice} from "../../storage/app_notice";
import {
  chatMessages,
  getChatPaging,
  prependChatMessages,
  replaceChatMessages,
  saveChatPaging,
  useTypewriterMessages,
  type StoredChatMessage,
} from "../../storage/chat_messages";
import {getWorkspaceState, saveWorkspaceState} from "../../storage/workspace";
import {saveSessionConfig} from "../../storage/session_config";
import {
  getSessionModelConfig,
  useWorkspaceLocalData,
  WorkspaceViewContext,
} from "./workspace_context";
import {workspaceTabKey, type WorkspaceChatTab} from "./types";

import {Effect} from "effect";

function createSessionId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const MESSAGE_PAGE_SIZE = 5;

function toStoredMessage(
  record: MessageRecord,
  sessionId: string,
  workspaceId: string,
): StoredChatMessage {
  const role = record.role === "user" || record.role === "assistant" || record.role === "system"
    ? record.role
    : "assistant";
  const numericCreated = record.created ? Number(record.created) : NaN;
  const createdAt = Number.isFinite(numericCreated)
    ? new Date(numericCreated > 1e12 ? numericCreated : numericCreated * 1000).toISOString()
    : undefined;

  return {
    id: record.messageId ?? record.id ?? `${sessionId}-${Date.now()}`,
    role,
    content: record.content ?? "",
    status: MessageStatus.STOP,
    history: true,
    sessionId,
    workspaceId,
    createdAt,
  };
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
}

/** 服务器工作区：左中右布局，界面状态保存到 storage/workspace.ts。 */
export function WorkspaceView(props: WorkspaceViewProps) {
  const navigate = useNavigate();
  const localData = useWorkspaceLocalData();
  const initial = localData.initial;
  const [layout, setLayout] = createSignal<LayoutState>(initial.layout);
  const [active, setActive] = createSignal<SideNavKey>(initial.active);
  const [workspaces, setWorkspaces] = createSignal<Workspace[]>(initial.workspaces);
  const [activeConversationId, setActiveConversationId] = createSignal(
    initial.activeConversationId,
  );
  createEffect(() => {
    const config = getSessionModelConfig(activeConversationId());
    setSelectedModel(config.model);
    setSelectedProvider(config.provider);
  });

  const [modelGroups, setModelGroups] = createSignal<ChatModelGroup[]>([]);
  const [selectedModel, setSelectedModel] = createSignal(initial.selectedModel);
  const [selectedProvider, setSelectedProvider] = createSignal(initial.selectedProvider);
  const [availableProviders, setAvailableProviders] = createSignal<ProviderOption[]>([]);
  const [managedProviders, setManagedProviders] = createSignal<ManagedProvider[]>([]);
  const pendingSessions = new Set<string>();
  const loadingSessions = new Set<string>();
  const [editConversation, setEditConversation] = createSignal<{
    workspaceId: string;
    conversationId: string;
    title: string;
  } | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [editSaving, setEditSaving] = createSignal(false);
  const [workspaceMenu, setWorkspaceMenu] = createSignal<Workspace | null>(null);
  const [workspaceMenuMode, setWorkspaceMenuMode] = createSignal<"edit" | "remove">("edit");
  const [workspaceName, setWorkspaceName] = createSignal("");
  const [workspacePaths, setWorkspacePaths] = createSignal<string[]>([]);
  const [workspaceSaving, setWorkspaceSaving] = createSignal(false);
  const [workspacePickerOpen, setWorkspacePickerOpen] = createSignal(false);
  const [workspacePickerCreate, setWorkspacePickerCreate] = createSignal(false);
  const [workspaceCreateFromSelect, setWorkspaceCreateFromSelect] = createSignal(false);
  const [assignCreatedWorkspace, setAssignCreatedWorkspace] = createSignal(false);
  const sessionCreations = new Map<string, Promise<void>>();
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

  onMount(() => {
    const handleResize = () => {
      setNarrowLayout(window.innerWidth < NARROW_LAYOUT_WIDTH);
    };
    window.addEventListener("resize", handleResize);
    onCleanup(() => window.removeEventListener("resize", handleResize));
  });

  createEffect(() => {
    saveWorkspaceState({
      layout: layout(),
      active: active(),
      workspaces: workspaces(),
      activeConversationId: activeConversationId(),
      selectedModel: selectedModel(),
      selectedProvider: selectedProvider(),
    });
  });

  const currentServer = () => localData.serverConfig();

  const api = () => createApiClient();

  const chatSource = () => chatMessages(activeConversationId())();
  const typedMessages = useTypewriterMessages(chatSource, activeConversationId);

  const activeConversation = () => {
    const conversationId = activeConversationId();
    for (const workspace of workspaces()) {
      const conversation = workspace.conversations.find((item) => item.id === conversationId);
      if (conversation) return {workspace, conversation};
    }
    return null;
  };

  const workspaceIdForSession = (sessionId: string) =>
    workspaces().find((workspace) =>
      workspace.conversations.some((conversation) => conversation.id === sessionId))?.id ?? "";

  const loadConversationMessages = async (sessionId: string) => {
    if (!sessionId || pendingSessions.has(sessionId) || loadingSessions.has(sessionId)) return;
    if (chatMessages(sessionId)().length > 0) return;
    // 已经拉取过首页（即使结果为空）时不再重复请求。
    if (getChatPaging(sessionId).page > 0) return;

    loadingSessions.add(sessionId);
    try {
      const page = await Effect.runPromise(api().message.list(sessionId, {
        page: 1,
        pageSize: MESSAGE_PAGE_SIZE,
      }));
      const workspaceId = workspaceIdForSession(sessionId);
      const rows = page.rows.slice().reverse().map((record) =>
        toStoredMessage(record, sessionId, workspaceId));
      replaceChatMessages(sessionId, rows);
      saveChatPaging(sessionId, {
        page: 1,
        hasMore: page.total === null
          ? page.rows.length >= MESSAGE_PAGE_SIZE
          : page.total > MESSAGE_PAGE_SIZE,
      });
    } catch {
      showNotice("error", "获取消息列表失败");
    } finally {
      loadingSessions.delete(sessionId);
    }
  };

  const loadOlderMessages = async () => {
    const sessionId = activeConversationId();
    if (!sessionId || loadingSessions.has(sessionId)) return;

    const paging = getChatPaging(sessionId);
    if (!paging.hasMore || paging.page <= 0) return;

    loadingSessions.add(sessionId);
    const nextPage = paging.page + 1;
    try {
      const page = await Effect.runPromise(api().message.list(sessionId, {
        page: nextPage,
        pageSize: MESSAGE_PAGE_SIZE,
      }));
      const workspaceId = workspaceIdForSession(sessionId);
      const rows = page.rows.slice().reverse().map((record) =>
        toStoredMessage(record, sessionId, workspaceId));
      prependChatMessages(sessionId, rows);
      saveChatPaging(sessionId, {
        page: nextPage,
        hasMore: page.total === null
          ? page.rows.length >= MESSAGE_PAGE_SIZE
          : nextPage * MESSAGE_PAGE_SIZE < page.total,
      });
    } catch {
      showNotice("error", "获取历史消息失败");
    } finally {
      loadingSessions.delete(sessionId);
    }
  };

  createEffect(() => {
    const sessionId = activeConversationId();
    if (sessionId) void loadConversationMessages(sessionId);
  });

  const sendChat = async (content: string): Promise<boolean> => {
    if (!content.trim()) return false;

    const target = activeConversation();
    const user = localData.currentUser();
    const model = selectedModel().trim();
    if (!target) {
      if (activeConversationId()) {
        showNotice("error", "请先选择工作区");
      } else {
        showNotice("error", "请先选择或新建对话");
      }
      return false;
    }
    if (!user) {
      showNotice("error", "登录信息已失效");
      return false;
    }
    if (!model) {
      showNotice("error", "请先选择模型");
      return false;
    }

    const sessionId = target.conversation.id;
    let sessionTitle = target.conversation.title;
    const isNewSession = pendingSessions.has(sessionId);

    // 新会话在参数校验通过后、提交消息前创建，并同时绑定工作区。
    if (isNewSession) {
      sessionTitle = content.trim().slice(0, 10) || "新的对话";
      let creation = sessionCreations.get(sessionId);
      if (!creation) {
        creation = Effect.runPromise(api().session.create({
          sessionId,
          sessionTitle,
          workspaceId: target.workspace.id,
        })).then(() => {
          pendingSessions.delete(sessionId);
          setWorkspaces((list) => list.map((workspace) =>
            workspace.id === target.workspace.id
              ? {
                ...workspace,
                conversations: workspace.conversations.map((conversation) =>
                  conversation.id === sessionId
                    ? {...conversation, title: sessionTitle}
                    : conversation),
              }
              : workspace,
          ));
          openConversationTab(target.workspace.id, sessionId);
        }).finally(() => {
          sessionCreations.delete(sessionId);
        });
        sessionCreations.set(sessionId, creation);
      }

      try {
        await creation;
      } catch {
        showNotice("error", "创建会话失败");
        return false;
      }
    }

    saveSessionConfig(sessionId, {
      workspaceId: target.workspace.id,
      model,
      provider: selectedProvider().trim() || "openai",
    });
    enqueueChatMessage({
      sessionId,
      workspaceId: target.workspace.id,
      tenantId: user.tenantId,
      userId: user.id,
      sessionTitle,
      provider: selectedProvider().trim() || "openai",
      model,
      content,
      sessionReady: true,
    });
    return true;
  };

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
  });

  const loadModelGroups = async () => {
    try {
      const client = api();
      const [available, managed] = await Promise.all([
        Effect.runPromise(client.supplierConfig.list()),
        Effect.runPromise(client.supplierConfig.listModels()),
      ]);

      setAvailableProviders(available.map((provider) => ({
        name: provider.provider,
        description: provider.description,
        baseUrl: provider.baseUrl ?? "",
      })));

      const groups: ManagedProvider[] = managed.map((provider) => ({
        providerName: provider.provider,
        providerAlias: provider.alias ?? undefined,
        baseUrl: provider.baseUrl ?? "",
        models: provider.models.map((model) => ({
          id: model.model,
          enabled: model.enabled,
        })),
      }));
      setManagedProviders(groups);
      setModelGroups(groups.map((provider) => ({
        providerName: provider.providerName,
        providerAlias: provider.providerAlias,
        models: provider.models,
      })));
    } catch {
      showNotice("error", "获取模型列表失败");
    }
  };

  const connectProvider = async (provider: ProviderOption, values: { apiKey: string; baseUrl: string }) => {
    await Effect.runPromise(
      api().supplierConfig.save({
        provider: provider.name,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
      }),
    );
    await loadModelGroups();
  };

  const toggleManagedModel = async (
    provider: ManagedProvider,
    model: ManagedModel,
    enabled: boolean,
  ) => {
    await Effect.runPromise(
      api().supplierConfig.saveOption({
        provider: provider.providerName,
        model: model.id,
        enabled,
      }),
    );
    await loadModelGroups();
  };

  const userData = (): SideNavUserData | undefined => {
    const info = localData.currentUser();
    return info ? {name: info.name ?? info.username, username: info.username} : undefined;
  };

  const assignActiveConversationToWorkspace = async (workspaceId: string) => {
    const sessionId = activeConversationId();
    if (!sessionId) return;

    const target = workspaces().find((workspace) => workspace.id === workspaceId);
    if (!target) return;
    const existing = activeConversation();
    if (existing?.workspace.id === workspaceId) {
      setWorkspacePickerOpen(false);
      return;
    }

    const tabLabel = props.tabs?.find((tab) => tab.conversationId === sessionId)?.label;
    const title = existing?.conversation.title
      ?? tabLabel?.split(" / ").pop()
      ?? "新对话";

    setWorkspaces((list) => list.map((workspace) => {
      const conversations = workspace.conversations.filter(
        (conversation) => conversation.id !== sessionId,
      );
      return workspace.id === workspaceId
        ? {...workspace, conversations: [...conversations, {id: sessionId, title}]}
        : {...workspace, conversations};
    }));
    saveSessionConfig(sessionId, {workspaceId});
    openConversationTab(workspaceId, sessionId);
    setWorkspacePickerOpen(false);
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

  const openWorkspaceCreate = (assignActive: boolean) => {
    setAssignCreatedWorkspace(assignActive);
    setWorkspaceCreateFromSelect(false);
    setWorkspacePickerCreate(true);
    setWorkspacePickerOpen(true);
  };

  const openWorkspaceSelect = () => {
    setWorkspacePickerCreate(false);
    setWorkspacePickerOpen(true);
  };

  const closeWorkspacePicker = () => {
    setWorkspacePickerOpen(false);
    setWorkspacePickerCreate(false);
    setWorkspaceCreateFromSelect(false);
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
    closeWorkspacePicker();
    if (assignCreatedWorkspace()) {
      await assignActiveConversationToWorkspace(workspace.id);
    }
  };

  const openWorkspaceEdit = (workspaceId: string) => {
    const workspace = workspaces().find((item) => item.id === workspaceId);
    if (!workspace) return;
    setWorkspaceMenu(workspace);
    setWorkspaceMenuMode("edit");
    setWorkspaceName(workspace.name);
    setWorkspacePaths(workspace.path ?? []);
  };

  const openWorkspaceRemove = (workspaceId: string) => {
    const workspace = workspaces().find((item) => item.id === workspaceId);
    if (!workspace) return;
    setWorkspaceMenu(workspace);
    setWorkspaceMenuMode("remove");
  };

  const closeWorkspaceMenu = () => {
    if (workspaceSaving()) return;
    setWorkspaceMenu(null);
  };

  const addWorkspacePath = async () => {
    try {
      const path = await pickWorkspaceDirectory();
      if (!path) return;
      setWorkspacePaths((current) =>
        current.includes(path) ? current : [...current, path]);
    } catch {
      showNotice("error", "选择工作目录失败");
    }
  };

  const saveWorkspaceName = async () => {
    const target = workspaceMenu();
    const name = workspaceName().trim();
    if (!target || !name || workspaceSaving()) return;

    setWorkspaceSaving(true);
    try {
      const paths = workspacePaths();
      await Effect.runPromise(api().workspace.update(target.id, {
        name,
        path: paths,
      }));
      setWorkspaces((list) => list.map((workspace) =>
        workspace.id === target.id ? {...workspace, name, path: paths} : workspace));
      setWorkspaceMenu(null);
    } catch {
      showNotice("error", "修改工作区失败");
    } finally {
      setWorkspaceSaving(false);
    }
  };

  const removeWorkspace = async () => {
    const target = workspaceMenu();
    if (!target || workspaceSaving()) return;

    setWorkspaceSaving(true);
    try {
      await Effect.runPromise(api().workspace.delete(target.id));
      setWorkspaces((list) => list.filter((workspace) => workspace.id !== target.id));
      if (target.conversations.some(
        (conversation) => conversation.id === activeConversationId(),
      )) {
        setActiveConversationId("");
        navigate("/");
      }
      setWorkspaceMenu(null);
    } catch {
      showNotice("error", "移除工作区失败");
    } finally {
      setWorkspaceSaving(false);
    }
  };

  const openEditConversation = (
    workspaceId: string,
    conversation: {id: string; title: string},
  ) => {
    setEditConversation({
      workspaceId,
      conversationId: conversation.id,
      title: conversation.title,
    });
    setEditTitle(conversation.title);
  };

  const saveConversationTitle = async () => {
    const target = editConversation();
    const title = editTitle().trim();
    if (!target || !title || editSaving()) return;

    setEditSaving(true);
    try {
      if (!pendingSessions.has(target.conversationId)) {
        await Effect.runPromise(api().session.update(target.conversationId, {
          sessionTitle: title,
          workspaceId: target.workspaceId,
        }));
      }
      setWorkspaces((list) => list.map((workspace) =>
        workspace.id === target.workspaceId
          ? {
            ...workspace,
            conversations: workspace.conversations.map((conversation) =>
              conversation.id === target.conversationId
                ? {...conversation, title}
                : conversation),
          }
          : workspace,
      ));
      openConversationTab(target.workspaceId, target.conversationId);
      setEditConversation(null);
    } catch(e) {
      console.log(e)
      showNotice("error", "修改会话标题失败");
    } finally {
      setEditSaving(false);
    }
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

  const resetModelSelection = () => {
    setSelectedModel("");
    setSelectedProvider("");
  };

  const addConversation = (workspaceId: string) => {
    resetModelSelection();
    const id = createSessionId();
    const title = "新的对话";
    pendingSessions.add(id);
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
    resetModelSelection();
    const id = createSessionId();
    const title = "新的对话";
    pendingSessions.add(id);
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

  const renderChat = () => (
            <LlmChat
            messages={typedMessages()}
            streaming={isChatStreaming(activeConversationId())}
            onSend={sendChat}
            modelGroups={modelGroups()}
            modelName={selectedModel()}
            providerAlias={selectedProvider()}
            onOpenModels={() => void loadModelGroups()}
            onScrollTop={() => void loadOlderMessages()}
            workspaceName={activeConversation()?.workspace.name ?? ""}
            onSelectWorkspace={openWorkspaceSelect}
            providers={availableProviders()}
            managedProviders={managedProviders()}
            onConnectProvider={connectProvider}
            onToggleModel={toggleManagedModel}
            onSelectModel={(model, group) => {
              setSelectedModel(model);
              setSelectedProvider(group.providerName);
              saveSessionConfig(activeConversationId(), {
                model,
                provider: group.providerName,
              });
            }}
    />
  );

  return (
    <WorkspaceViewContext.Provider value={{active, activeConversationId}}>
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
              setActiveConversationId(conversationId);
              openConversationTab(workspaceId, conversationId);
              navigate(`/chat/${conversationId}`);
            }}
            onSearch={() => undefined}
            onCreateWorkspace={() => openWorkspaceCreate(false)}
            onEditWorkspace={openWorkspaceEdit}
            onRemoveWorkspace={openWorkspaceRemove}
            onCreateConversation={addConversation}
            onEditConversation={openEditConversation}
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
            {() => renderChat()}
          </For>
        </Show>
      </ThreePaneLayout>

      <WorkspaceSelect
        open={workspacePickerOpen() && !workspacePickerCreate()}
        workspaces={workspaces().map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
        }))}
        activeWorkspaceId={activeConversation()?.workspace.id}
        onSelect={(workspaceId) => void assignActiveConversationToWorkspace(workspaceId)}
        onCreate={() => {
          setWorkspaceCreateFromSelect(true);
          setWorkspacePickerCreate(true);
        }}
        onClose={closeWorkspacePicker}
      />

      <WorkspaceCreate
        open={workspacePickerOpen() && workspacePickerCreate()}
        onSubmit={createWorkspaceFromPicker}
        onPickDirectory={pickWorkspaceDirectory}
        onBack={workspaceCreateFromSelect()
          ? () => setWorkspacePickerCreate(false)
          : undefined}
        onClose={closeWorkspacePicker}
      />

      <Dialog
        open={workspaceMenu() !== null}
        onClose={closeWorkspaceMenu}
        size="sm"
        header={
          <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
            {workspaceMenuMode() === "edit" ? "编辑工作区" : "移除工作区"}
          </h2>
        }
      >
        <Show when={workspaceMenuMode() === "edit"}>
          <div class="grid gap-2">
            <label class="grid gap-2">
              <span class="text-[13px] text-slate-600 dark:text-slate-300">工作区名称</span>
              <input
                value={workspaceName()}
                onInput={(event) => setWorkspaceName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveWorkspaceName();
                }}
                maxlength={256}
                autofocus
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </label>
            <div class="grid gap-2">
              <span class="text-[13px] text-slate-600 dark:text-slate-300">工作区目录</span>
              <Show
                when={workspacePaths().length > 0}
                fallback={
                  <p class="m-0 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[13px] text-slate-400 dark:border-white/10 dark:text-slate-500">
                    未配置工作目录
                  </p>
                }
              >
                <ul class="m-0 grid list-none gap-1 p-0">
                  <For each={workspacePaths()}>
                    {(item) => (
                      <li class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        <span class="min-w-0 flex-1 truncate">{item}</span>
                        <button
                          type="button"
                          onClick={() => setWorkspacePaths((current) =>
                            current.filter((path) => path !== item))}
                          disabled={workspaceSaving()}
                          aria-label={`移除目录 ${item}`}
                          title="移除目录"
                          class="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-60 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          <TrashIcon class="h-3.5 w-3.5" />
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
              <button
                type="button"
                onClick={() => void addWorkspacePath()}
                disabled={workspaceSaving()}
                class="flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[13px] text-slate-600 outline-none transition hover:border-sky-400 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-60 dark:border-white/15 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:bg-sky-500/10"
              >
                <PlusIcon class="h-3.5 w-3.5" />
                添加目录
              </button>
            </div>
            <div class="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeWorkspaceMenu}
                disabled={workspaceSaving()}
                class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveWorkspaceName()}
                disabled={workspaceSaving() || !workspaceName().trim()}
                class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
              >
                {workspaceSaving() ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </Show>

        <Show when={workspaceMenuMode() === "remove"}>
          <div class="grid gap-3">
            <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
              确定移除工作区「{workspaceMenu()?.name}」？此操作不可撤销。
            </p>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeWorkspaceMenu}
                disabled={workspaceSaving()}
                class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void removeWorkspace()}
                disabled={workspaceSaving()}
                class="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-progress disabled:opacity-70"
              >
                {workspaceSaving() ? "移除中…" : "移除"}
              </button>
            </div>
          </div>
        </Show>
      </Dialog>

      <Dialog
        open={editConversation() !== null}
        onClose={() => {
          if (!editSaving()) setEditConversation(null);
        }}
        size="sm"
        header={
          <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
            编辑会话
          </h2>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditConversation(null)}
              disabled={editSaving()}
              class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void saveConversationTitle()}
              disabled={editSaving() || !editTitle().trim()}
              class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
            >
              {editSaving() ? "保存中…" : "保存"}
            </button>
          </>
        }
      >
        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">会话标题</span>
          <input
            value={editTitle()}
            onInput={(event) => setEditTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveConversationTitle();
            }}
            maxlength={256}
            autofocus
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100"
          />
        </label>
      </Dialog>
    </WorkspaceViewContext.Provider>
  );
}
