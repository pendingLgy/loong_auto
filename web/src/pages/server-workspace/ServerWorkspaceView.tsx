import {createSignal, type JSX} from "solid-js";

import {useNavigate} from "@solidjs/router";

import {type LayoutState, ThreePaneLayout} from "@loong/ui/layout";
import {SideNav, type SideNavKey, type SideNavUserData, type Workspace} from "@loong/ui/nav";
import {serverConfig, servers} from "../../storage/server_config";
import {getLayoutState, saveLayoutState} from "../../storage/settings";
import {currentUser} from "../../storage/user";
import {HomeIndex} from "./HomeIndex";
import {HomeViewContext} from "./home-context";

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
  /** 中栏内容；为空时渲染 HomeIndex。 */
  children?: JSX.Element;
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

  const currentServer = () =>
    servers().find((server) => server.id === props.serverId) ?? serverConfig();

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
        {props.children ?? <HomeIndex/>}
      </ThreePaneLayout>
    </HomeViewContext.Provider>
  );
}
