import {createSignal} from "solid-js";

import {useNavigate} from "@solidjs/router";

import {LlmChat, type ChatModelGroup} from "@loong/ui/chat";
import type {ManagedModel, ManagedProvider, ProviderOption} from "@loong/ui/model-picker";
import {type LayoutState, ThreePaneLayout} from "@loong/ui/layout";
import {SideNav, type SideNavKey, type SideNavUserData, type Workspace} from "@loong/ui/nav";
import {createApiClient} from "../../api";
import {showNotice} from "../../storage/app_notice";
import {serverConfig, servers} from "../../storage/server_config";
import {getLayoutState, saveLayoutState} from "../../storage/settings";
import {currentUser} from "../../storage/user";
import {HomeViewContext} from "./home-context";

import {Effect} from "effect";

const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: "workspace-default",
    name: "默认工作区",
    conversations: [{id: "conversation-1", title: "新的对话"}],
  },
];

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
  const [layout, setLayout] = createSignal<LayoutState>(getLayoutState());
  const [active, setActive] = createSignal<SideNavKey>("newChat");
  const [workspaces, setWorkspaces] = createSignal<Workspace[]>(INITIAL_WORKSPACES);
  const [activeConversationId, setActiveConversationId] = createSignal(
    INITIAL_WORKSPACES[0].conversations[0].id,
  );
  const [modelGroups, setModelGroups] = createSignal<ChatModelGroup[]>([]);
  const [selectedModel, setSelectedModel] = createSignal("");
  const [selectedProvider, setSelectedProvider] = createSignal("");
  const [availableProviders, setAvailableProviders] = createSignal<ProviderOption[]>([]);
  const [managedProviders, setManagedProviders] = createSignal<ManagedProvider[]>([]);

  const currentServer = () =>
    servers().find((server) => server.id === props.serverId) ?? serverConfig();

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
    } catch {
      showNotice("error", "获取模型列表失败");
    }
  };

  const connectProvider = async (provider: ProviderOption, values: { apiKey: string; baseUrl: string }) => {
    await Effect.runPromise(
      createApiClient().supplierConfig.save({
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
      createApiClient().supplierConfig.saveOption({
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

  const createWorkspace = () => {
    setWorkspaces((list) => [
      ...list,
      {id: createId("workspace"), name: "新的工作区", conversations: []},
    ]);
  };

  const newChat = () => {
    const first = workspaces()[0];
    if (first) {
      addConversation(first.id);
    } else {
      createWorkspace();
      navigate("/");
    }
  };

  const onLayoutChange = (next: LayoutState) => {
    setLayout(next);
    saveLayoutState(next);
  };

  return (
    <HomeViewContext.Provider value={{active, activeConversationId}}>
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
            onCreateWorkspace={createWorkspace}
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
      </ThreePaneLayout>
    </HomeViewContext.Provider>
  );
}
