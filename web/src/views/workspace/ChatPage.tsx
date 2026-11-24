import { createEffect, createSignal, on, onMount } from "solid-js";

import { ClientError, type MessageRecord, type WorkspaceMode } from "@loong/client";
import { LlmChat, type ChatModelGroup } from "@loong/ui/chat";
import type { ManagedModel, ManagedProvider, ProviderOption } from "@loong/ui/model-picker";
import { createEventListener } from "@solid-primitives/event-listener";
import {
  notifySessionCreated,
  SESSION_CONFIG_EVENT,
  type SessionConfigEventDetail,
} from "../../events";
import { WorkspaceCreate, WorkspaceSelect, type WorkspaceCreateInput } from "@loong/ui/workspace-picker";
import { Effect } from "effect";

import { createApiClient } from "../../api";
import { enqueueChatMessage, isChatStreaming, startChatExecutor } from "../../chat/executor";
import { MessageStatus } from "../../chat/status";
import { showNotice } from "../../storage/app_notice";
import {
  appendToolCallMessage,
  chatMessages,
  getChatPaging,
  prependChatMessages,
  replaceChatMessages,
  saveChatPaging,
  useTypewriterMessages,
  type StoredChatMessage,
} from "../../storage/chat_messages";
import { getSessionConfig, saveSessionConfig } from "../../storage/session_config";
import { ToolCallsView } from "./ToolCallsView";
import { currentUser } from "../../storage/user";

const MESSAGE_PAGE_SIZE = 10;

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

export interface ChatPageProps {
  /** 当前会话 ID。 */
  sessionId: string;
  /** 新建工作区成功后的回调。 */
  onWorkspaceCreated?: () => void | Promise<void>;
}

/** 会话聊天页面：根据传入 sessionId 独立加载消息、模型与发送逻辑。 */
export function ChatPage(props: ChatPageProps) {
  const [loading, setLoading] = createSignal(false);
  const [loadingOlder, setLoadingOlder] = createSignal(false);
  const [configVersion, setConfigVersion] = createSignal(0);
  const [modelGroups, setModelGroups] = createSignal<ChatModelGroup[]>([]);
  const [availableProviders, setAvailableProviders] = createSignal<ProviderOption[]>([]);
  const [managedProviders, setManagedProviders] = createSignal<ManagedProvider[]>([]);
  const [workspaceName, setWorkspaceName] = createSignal("");
  const [workspaceItems, setWorkspaceItems] = createSignal<
    Array<{id: string; name: string; paths: string[]}>
  >([]);
  const [workspaceSelectOpen, setWorkspaceSelectOpen] = createSignal(false);
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = createSignal(false);
  const initialConfig = getSessionConfig(props.sessionId);
  const [selectedModel, setSelectedModel] = createSignal(initialConfig.model ?? "");
  const [selectedProvider, setSelectedProvider] = createSignal(initialConfig.provider ?? "");
  const [workspaceMode, setWorkspaceMode] = createSignal<WorkspaceMode>(
    initialConfig.workspaceMode ?? "read_only",
  );
  const sessionCreations = new Map<string, Promise<void>>();
  const approvedTools = new Set<string>();
  let loadedWorkspaceNameId = "";

  const sessionId = () => props.sessionId;
  const workspaceId = () => getSessionConfig(sessionId()).workspaceId ?? "";
  const chatSource = () => chatMessages(sessionId())();
  const typedMessages = useTypewriterMessages(chatSource, sessionId);


  const latestToolCallMessage = () => {
    const list = chatSource();
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const message = list[index];
      if (message.status === MessageStatus.TOOL_CALLING && message.tool_calls?.length) {
        return message;
      }
    }
    return undefined;
  };

  const approveTool = async (messageId: string, toolId: string): Promise<boolean> => {
    if (approvedTools.has(toolId)) return true;
    approvedTools.add(toolId);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const result = await Effect.runPromise(createApiClient().tools.approve(
          sessionId(),
          toolId,
          {approved: true},
        ));
        appendToolCallMessage(sessionId(), messageId, result);
        return true;
      } catch (error) {
        // 本地 SSE Worker 可能尚未把待审批任务写入数据库。
        if (error instanceof ClientError && error.status === 404 && attempt < 19) {
          await new Promise((resolve) => window.setTimeout(resolve, 100));
          continue;
        }
        approvedTools.delete(toolId);
        showNotice("error", "执行工具失败");
        return false;
      }
    }
    approvedTools.delete(toolId);
    return false;
  };

  const loadFirstPage = async (id: string) => {
    if (!id || loading()) return;
    // 已经加载过首页时直接复用本地消息，仅在首次打开时请求。
    if (getChatPaging(id).page > 0) return;

    setLoading(true);
    try {
      const page = await Effect.runPromise(createApiClient().message.list(id, {
        page: 1,
        pageSize: MESSAGE_PAGE_SIZE,
      }));
      const rows = page.rows.slice().reverse().map((record) =>
        toStoredMessage(record, id, workspaceId()));
      replaceChatMessages(id, rows);
      saveChatPaging(id, {
        page: 1,
        hasMore: page.total === null
          ? page.rows.length >= MESSAGE_PAGE_SIZE
          : page.total > MESSAGE_PAGE_SIZE,
      });
    } catch {
      // 新会话尚未在云端创建时忽略，保留本地缓存。
    } finally {
      setLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    const id = sessionId();
    if (!id || loading() || loadingOlder()) return;

    const paging = getChatPaging(id);
    if (!paging.hasMore || paging.page <= 0) return;

    const nextPage = paging.page + 1;
    setLoadingOlder(true);
    try {
      const page = await Effect.runPromise(createApiClient().message.list(id, {
        page: nextPage,
        pageSize: MESSAGE_PAGE_SIZE,
      }));
      const rows = page.rows.slice().reverse().map((record) =>
        toStoredMessage(record, id, workspaceId()));
      prependChatMessages(id, rows);
      saveChatPaging(id, {
        page: nextPage,
        hasMore: page.total === null
          ? page.rows.length >= MESSAGE_PAGE_SIZE
          : nextPage * MESSAGE_PAGE_SIZE < page.total,
      });
    } catch {
      // 保持现有消息，不打断阅读。
    } finally {
      setLoadingOlder(false);
    }
  };

  const loadModelGroups = async () => {
    try {
      const client = createApiClient();
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
    } catch (e) {
      showNotice("error", "获取模型列表失败");
    }
  };

  const connectProvider = async (
    provider: ProviderOption,
    values: {apiKey: string; baseUrl: string},
  ) => {
    await Effect.runPromise(createApiClient().supplierConfig.save({
      provider: provider.name,
      apiKey: values.apiKey,
      baseUrl: values.baseUrl,
    }));
    await loadModelGroups();
  };

  const toggleManagedModel = async (
    provider: ManagedProvider,
    model: ManagedModel,
    enabled: boolean,
  ) => {
    await Effect.runPromise(createApiClient().supplierConfig.saveOption({
      provider: provider.providerName,
      model: model.id,
      enabled,
    }));
    await loadModelGroups();
  };

  const selectModel = (model: string, group: ChatModelGroup) => {
    setSelectedModel(model);
    setSelectedProvider(group.providerName);
    saveSessionConfig(sessionId(), {model, provider: group.providerName});
  };

  const loadWorkspaces = async () => {
    try {
      const page = await Effect.runPromise(createApiClient().workspace.list({
        page: 1,
        pageSize: 100,
      }));
      setWorkspaceItems(page.rows.map((item) => ({
        id: item.id,
        name: item.name?.trim() || item.path[0] || "未命名工作区",
        paths: item.path,
      })));
    } catch {
      // 保持当前工作区列表。
    }
  };

  const openWorkspaceSelect = () => {
    void loadWorkspaces();
    setWorkspaceSelectOpen(true);
  };

  const saveWorkspaceAccess = async (mode: WorkspaceMode): Promise<boolean> => {
    const id = sessionId();
    const workspace = workspaceId();
    if (!id || !workspace) return false;

    let item = workspaceItems().find((entry) => entry.id === workspace);
    if (!item?.paths.length) {
      try {
        const info = await Effect.runPromise(createApiClient().workspace.get(workspace));
        item = {
          id: workspace,
          name: item?.name ?? info.name?.trim() ?? "",
          paths: info.path,
        };
        setWorkspaceItems((current) => current.map((entry) =>
          entry.id === workspace ? item! : entry));
      } catch {
        showNotice("error", "读取工作区目录失败");
        return false;
      }
    }

    try {
      await Effect.runPromise(createApiClient().sessionConfig.save(id, {
        workspaceId: workspace,
        workspaceMode: mode,
        workspaces: item.paths,
      }));
      return true;
    } catch {
      showNotice("error", "保存工作区权限失败");
      return false;
    }
  };

  const changeWorkspaceMode = async (mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    saveSessionConfig(sessionId(), {workspaceMode: mode});
    await saveWorkspaceAccess(mode);
  };

  const selectWorkspace = (id: string) => {
    const item = workspaceItems().find((workspace) => workspace.id === id);
    saveSessionConfig(sessionId(), {workspaceId: id});
    setWorkspaceName(item?.name ?? "");
    setWorkspaceSelectOpen(false);
    void saveWorkspaceAccess(workspaceMode());
  };

  const createWorkspace = async (input: WorkspaceCreateInput) => {
    const workspace = await Effect.runPromise(createApiClient().workspace.create({
      name: input.name,
      path: input.path,
    }));
    const item = {
      id: workspace.id,
      name: workspace.name?.trim() || input.name,
      paths: workspace.path,
    };
    setWorkspaceItems((current) => [...current, item]);
    await props.onWorkspaceCreated?.();
    saveSessionConfig(sessionId(), {workspaceId: item.id});
    setWorkspaceName(item.name);
    setWorkspaceCreateOpen(false);
    setWorkspaceSelectOpen(false);
    void saveWorkspaceAccess(workspaceMode());
  };

  const pickWorkspaceDirectory = async (): Promise<string | null> => {
    const picker = (window as Window & {
      showDirectoryPicker?: () => Promise<{name: string}>;
    }).showDirectoryPicker;
    if (!picker) throw new Error("当前环境不支持文件夹选择");
    const directory = await picker();
    return directory.name;
  };

  const sendChat = async (content: string): Promise<boolean> => {
    if (!content.trim()) return false;

    const id = sessionId();
    const user = currentUser();
    const model = selectedModel().trim();
    const workspace = workspaceId();
    if (!workspace) {
      showNotice("error", "请先选择工作区");
      openWorkspaceSelect();
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

    const pending = getSessionConfig(id).pending === true;
    let sessionTitle = "会话";
    if (pending) {
      sessionTitle = content.trim().slice(0, 10) || "新的对话";
      if (!await saveWorkspaceAccess(workspaceMode())) {
        return false;
      }
      let creation = sessionCreations.get(id);
      if (!creation) {
        creation = Effect.runPromise(createApiClient().session.create({
          sessionId: id,
          sessionTitle,
          workspaceId: workspace,
        })).then(() => {
          notifySessionCreated({
            workspaceId: workspace,
            workspaceName: workspaceName(),
            sessionId: id,
            title: sessionTitle,
          });
        }).finally(() => {
          sessionCreations.delete(id);
        });
        sessionCreations.set(id, creation);
      }

      try {
        await creation;
      } catch {
        showNotice("error", "创建会话失败");
        return false;
      }
    }

    saveSessionConfig(id, {
      pending: false,
      workspaceId: workspace,
      model,
      provider: selectedProvider().trim() || "openai",
    });
    enqueueChatMessage({
      sessionId: id,
      workspaceId: workspace,
      tenantId: user.tenantId,
      userId: user.id,
      sessionTitle,
      provider: selectedProvider().trim() || "openai",
      model,
      content,
      sessionReady: true,
    });
    startChatExecutor();
    return true;
  };

  createEffect(on(sessionId, (id) => {
    if (id) void loadFirstPage(id);
  }));

  createEffect(() => {
    configVersion();
    const config = getSessionConfig(sessionId());
    setSelectedModel(config.model ?? "");
    setSelectedProvider(config.provider ?? "");
    setWorkspaceMode(config.workspaceMode ?? "read_only");
    const workspace = workspaceId();
    if (!workspace) {
      loadedWorkspaceNameId = "";
      setWorkspaceName("");
      return;
    }
    if (workspace === loadedWorkspaceNameId) return;
    loadedWorkspaceNameId = workspace;
    void Effect.runPromise(createApiClient().workspace.get(workspace))
      .then((item) => setWorkspaceName(item.name?.trim() || item.path[0] || ""))
      .catch(() => setWorkspaceName(""));
  });

  createEffect(() => {
    const message = latestToolCallMessage();
    if (!message || message.history) return;
    for (const call of message.tool_calls ?? []) {
      if (!("dangerous" in call.arguments)) {
        void approveTool(message.id, call.id);
      }
    }
  });

  onMount(() => {
    void loadModelGroups();
    void loadWorkspaces();
    const onConfigChanged = (event: Event) => {
      const detail = (event as CustomEvent<SessionConfigEventDetail>).detail;
      if (detail?.sessionId === sessionId()) {
        setConfigVersion((current) => current + 1);
      }
    };
    createEventListener(window, SESSION_CONFIG_EVENT, onConfigChanged);
  });

  return (
    <>
      <LlmChat
        messages={typedMessages()}
        streaming={isChatStreaming(sessionId())}
        onSend={sendChat}
        modelGroups={modelGroups()}
        modelName={selectedModel()}
        providerAlias={selectedProvider()}
        onOpenModels={() => void loadModelGroups()}
        onScrollTop={() => void loadOlderMessages()}
        loadingOlder={loadingOlder()}
        toolCallsView={(message) => {
          const stored = message as StoredChatMessage;
          return (
            <ToolCallsView
              calls={stored.tool_calls ?? []}
              toolCallMessages={stored.tool_call_messages ?? []}
              onRunTool={(toolId) => approveTool(stored.id, toolId)}
            />
          );
        }}
        workspaceName={workspaceName()}
        workspaceMode={workspaceMode()}
        onWorkspaceModeChange={(mode) => void changeWorkspaceMode(mode)}
        onSelectWorkspace={openWorkspaceSelect}
        providers={availableProviders()}
        managedProviders={managedProviders()}
        onConnectProvider={connectProvider}
        onToggleModel={toggleManagedModel}
        onSelectModel={selectModel}
      />

      <WorkspaceSelect
        open={workspaceSelectOpen()}
        workspaces={workspaceItems()}
        activeWorkspaceId={workspaceId()}
        onSelect={selectWorkspace}
        onCreate={() => setWorkspaceCreateOpen(true)}
        onClose={() => setWorkspaceSelectOpen(false)}
      />

      <WorkspaceCreate
        open={workspaceCreateOpen()}
        onSubmit={createWorkspace}
        onPickDirectory={pickWorkspaceDirectory}
        onClose={() => setWorkspaceCreateOpen(false)}
      />
    </>
  );
}
