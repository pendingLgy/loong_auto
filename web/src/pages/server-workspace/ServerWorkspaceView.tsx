import {For, createEffect, createSignal} from "solid-js";

import {useNavigate} from "@solidjs/router";

import {LlmChat, type ChatModelGroup} from "@loong/ui/chat";
import type {ManagedModel, ManagedProvider, ProviderOption} from "@loong/ui/model-picker";
import {type LayoutState, ThreePaneLayout} from "@loong/ui/layout";
import {SideNav, type SideNavKey, type SideNavUserData, type Workspace} from "@loong/ui/nav";
import {createApiClient} from "../../api";
import {showNotice} from "../../storage/app_notice";
import {activeServerId, serverConfig, servers} from "../../storage/server_config";
import {getServerWorkspaceState, saveServerWorkspaceState} from "../../storage/server_workspace";
import {currentUser} from "../../storage/user";
import {WorkspaceViewContext} from "./workspace_context";

import {Effect} from "effect";

let nextId = 1;
const createId = (prefix: string) => `${prefix}-${Date.now()}-${nextId++}`;

export interface ServerWorkspaceViewProps {
  /** 指定服务器 id；省略时使用当前激活服务器。 */
  serverId?: string;
  /** 组件高度，默认 100%。 */
  height?: number | string;
}

/** 服务器工作区：左中右布局，布局状态保存到 storage/settings.ts。 */
export function ServerWorkspaceView(props: ServerWorkspaceViewProps) {
  const navigate = useNavigate();
  const serverId = () => props.serverId ?? activeServerId() ?? "";
  const initial = getServerWorkspaceState(serverId());
  const [layout, setLayout] = createSignal<LayoutState>(initial.layout);
  const [active, setActive] = createSignal<SideNavKey>(initial.active);
  const [workspaces, setWorkspaces] = createSignal<Workspace[]>(initial.workspaces);
  const [activeConversationId, setActiveConversationId] = createSignal(
    initial.activeConversationId,
  );
  const [modelGroups, setModelGroups] = createSignal<ChatModelGroup[]>([]);
  const [selectedModel, setSelectedModel] = createSignal(initial.selectedModel);
  const [selectedProvider, setSelectedProvider] = createSignal(initial.selectedProvider);
  const [availableProviders, setAvailableProviders] = createSignal<ProviderOption[]>([]);
  const [managedProviders, setManagedProviders] = createSignal<ManagedProvider[]>([]);

  createEffect(() => {
    saveServerWorkspaceState(serverId(), {
      layout: layout(),
      active: active(),
      workspaces: workspaces(),
      activeConversationId: activeConversationId(),
      selectedModel: selectedModel(),
      selectedProvider: selectedProvider(),
    });
  });

  const currentServer = () =>
    servers().find((server) => server.id === props.serverId) ?? serverConfig();

  const api = () => createApiClient({serverId: serverId()});

  const loadWorkspaces = async () => {
    try {
      const page = await Effect.runPromise(
        api().workspace.list({page: 1, pageSize: 1000}),
      );
      const stored = getServerWorkspaceState(serverId());
      const conversations = new Map(
        stored.workspaces.map((workspace) => [workspace.id, workspace.conversations]),
      );
      const rows = page.rows.map((workspace) => ({
        id: workspace.id,
        name: workspace.name?.trim() || workspace.path[0] || "未命名工作区",
        conversations: conversations.get(workspace.id) ?? [],
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

  createEffect(() => {
    if (serverId() === activeServerId()) {
      void loadWorkspaces();
    }
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
    const info = currentUser();
    return info ? {name: info.name ?? info.username, username: info.username} : undefined;
  };

  const addConversation = (workspaceId: string) => {
    const id = createId("conversation");
    setWorkspaces((list) =>
      list.map((workspace) =>
        workspace.id === workspaceId
          ? {...workspace, conversations: [...workspace.conversations, {id, title: "新的对话"}]}
          : workspace,
      ),
    );
    setActiveConversationId(id);
    setActive("newChat");
    navigate("/");
  };

  type DirectoryPicker = () => Promise<{ name: string }>;

  const createWorkspace = async (name = "新的工作区", path: string[] = [name]) => {
    try {
      const workspace = await Effect.runPromise(
        api().workspace.create({name, path}),
      );
      setWorkspaces((list) => [
        ...list,
        {id: workspace.id, name: workspace.name ?? name, conversations: []},
      ]);
    } catch {
      showNotice("error", "创建工作区失败");
    }
  };

  const openFolderPicker = async () => {
    const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker })
      .showDirectoryPicker;
    if (!picker) {
      showNotice("error", "当前环境不支持文件夹选择");
      return;
    }

    try {
      const directory = await picker();
      const name = directory.name.trim() || "新的工作区";
      await createWorkspace(name, [name]);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      showNotice("error", "选择文件夹失败");
    }
  };

  const newChat = () => {
    const first = workspaces()[0];
    if (first) {
      addConversation(first.id);
    } else {
      void openFolderPicker();
    }
  };

  const onLayoutChange = (next: LayoutState) => {
    setLayout(next);
  };

  const renderChat = () => (
            <LlmChat
            modelGroups={modelGroups()}
            modelName={selectedModel()}
            providerAlias={selectedProvider()}
            onOpenModels={() => void loadModelGroups()}
            providers={availableProviders()}
            managedProviders={managedProviders()}
            onConnectProvider={connectProvider}
            onToggleModel={toggleManagedModel}
            onSelectModel={(model, group) => {
              setSelectedModel(model);
              setSelectedProvider(group.providerAlias ?? group.providerName);
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
            onSelectConversation={(_, conversationId) => {
              setActiveConversationId(conversationId);
              navigate("/");
            }}
            onSearch={() => undefined}
            onCreateWorkspace={() => void openFolderPicker()}
            onMoreWorkspace={() => undefined}
            onCreateConversation={addConversation}
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
        <For each={[activeConversationId()]}>
          {() => renderChat()}
        </For>
      </ThreePaneLayout>
    </WorkspaceViewContext.Provider>
  );
}
