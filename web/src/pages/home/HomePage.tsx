import { createSignal, type JSX } from "solid-js";

import { useNavigate } from "@solidjs/router";

import { ThreePaneLayout, type LayoutState } from "@loong/ui/layout";
import { SideNav, type SideNavKey, type SideNavUserData, type Workspace } from "@loong/ui/nav";
import { serverConfig } from "../../storage/server_config";
import { getLayoutState, saveLayoutState } from "../../storage/settings";
import { clearUser, currentUser, userSession } from "../../storage/user";
import { HomeViewContext } from "./home-context";

const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: "workspace-default",
    name: "默认工作区",
    conversations: [{ id: "conversation-1", title: "新的对话" }],
  },
];

let nextId = 1;
const createId = (prefix: string) => `${prefix}-${Date.now()}-${nextId++}`;

export interface HomePageProps {
  /** 嵌套路由渲染在中栏的内容。 */
  children?: JSX.Element;
}

/** 登录后的首页：左中右布局，布局状态保存到 storage/settings.ts，下次打开优先读取。 */
export function HomePage(props: HomePageProps) {
  const navigate = useNavigate();
  const [layout, setLayout] = createSignal<LayoutState>(getLayoutState());
  const [active, setActive] = createSignal<SideNavKey>("newChat");
  const [workspaces, setWorkspaces] = createSignal<Workspace[]>(INITIAL_WORKSPACES);
  const [activeConversationId, setActiveConversationId] = createSignal(
    INITIAL_WORKSPACES[0].conversations[0].id,
  );

  const userData = (): SideNavUserData | undefined => {
    const info = currentUser();
    return info ? { name: info.name ?? info.username, username: info.username } : undefined;
  };

  const addConversation = (workspaceId: string) => {
    const id = createId("conversation");
    setWorkspaces((list) =>
      list.map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, conversations: [...workspace.conversations, { id, title: "新的对话" }] }
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
      { id: createId("workspace"), name: "新的工作区", conversations: [] },
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
    <HomeViewContext.Provider value={{ active, activeConversationId }}>
      <ThreePaneLayout
      value={layout()}
      onChange={onLayoutChange}
      minLeftWidth={260}
      minRightWidth={300}
      toolbar={
        <div class="flex min-w-0 items-center justify-between gap-3">
          <span class="truncate text-sm font-medium">Home</span>
          <div class="flex min-w-0 items-center gap-2">
            <span class="truncate text-xs text-slate-500 dark:text-slate-400">
              {userSession()?.user.username ?? ""}
            </span>
            <button
              type="button"
              onClick={() => clearUser()}
              class="shrink-0 rounded-md px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              退出
            </button>
          </div>
        </div>
      }
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
            服务器：{serverConfig()?.serverUrl ?? "未配置"}
          </p>
          <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
            选中左侧条目后，这里展示对应的工具与审批信息。
          </p>
        </div>
      }
    >
      {props.children}
    </ThreePaneLayout>
    </HomeViewContext.Provider>
  );
}
