import { createSignal } from "solid-js";

import type { Locale } from "../../src/i18n";
import { SideNav, SideNavMenu, SideNavUser, SideNavWorkspace, type SideNavKey, type Workspace } from "../../src/nav";
import type { PreviewCase } from "../types";

const WORKSPACES: Workspace[] = [
  {
    id: "A",
    name: "A",
    conversations: [
      { id: "A-1", title: "对话A" },
      { id: "A-2", title: "对话B" },
    ],
  },
  {
    id: "B",
    name: "B",
    conversations: [
      { id: "B-1", title: "对话A" },
      { id: "B-2", title: "对话B" },
    ],
  },
];

function NavCase(props: { locale?: Locale; initial?: SideNavKey }) {
  const [active, setActive] = createSignal<SideNavKey>(props.initial ?? "newChat");
  const [conversation, setConversation] = createSignal("A-1");
  const [lastAction, setLastAction] = createSignal("无");

  return (
    <div class="flex overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <SideNav
        locale={props.locale}
        height={'80vh'}
        active={active()}
        onSelect={setActive}
        workspaces={WORKSPACES}
        activeConversationId={conversation()}
        onSelectConversation={(_, conversationId) => setConversation(conversationId)}
        onNewChat={() => setLastAction("新建对话")}
        onAutomation={() => setLastAction("自动化任务")}
        onSearch={() => setLastAction("搜索工作区")}
        onCreateWorkspace={() => setLastAction("新增工作区")}
        onMoreWorkspace={(workspaceId) => setLastAction(`更多：${workspaceId}`)}
        onCreateConversation={(workspaceId) => setLastAction(`新建对话：${workspaceId}`)}
        user={{ name: "Loong", username: "loong@example.com" }}
        onUserClick={() => setLastAction("用户菜单")}
        onSettings={() => setLastAction("设置")}
      />
      <div class="grid flex-1 place-items-center p-6 text-sm text-slate-500 dark:text-slate-400">
        当前选中：{active()} / {conversation()}，操作：{lastAction()}
      </div>
    </div>
  );
}

function UserCase(props: { locale?: Locale }) {
  return (
    <div class="w-56 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <SideNavUser
        locale={props.locale}
        user={{ name: "Loong", username: "loong@example.com" }}
      />
    </div>
  );
}

function MenuOnlyCase(props: { locale?: Locale; initial?: SideNavKey }) {
  const [active, setActive] = createSignal<SideNavKey>(props.initial ?? "newChat");

  return (
    <div class="w-56 rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <SideNavMenu locale={props.locale} active={active()} onSelect={setActive} />
    </div>
  );
}

function WorkspaceOnlyCase(props: { locale?: Locale }) {
  const [conversation, setConversation] = createSignal("A-1");

  return (
    <div class="w-56 rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <SideNavWorkspace
        locale={props.locale}
        workspaces={WORKSPACES}
        activeConversationId={conversation()}
        onSelectConversation={(_, conversationId) => setConversation(conversationId)}
      />
    </div>
  );
}

export const navCases: PreviewCase[] = [
  {
    id: "nav-menu",
    group: "SideNav",
    title: "仅主导航（SideNavMenu）",
    render: () => <MenuOnlyCase />,
  },
  {
    id: "nav-user",
    group: "SideNav",
    title: "底部用户栏（SideNavUser）",
    render: () => <UserCase />,
  },
  {
    id: "nav-workspace",
    group: "SideNav",
    title: "仅工作区（SideNavWorkspace）",
    render: () => <WorkspaceOnlyCase />,
  },
  {
    id: "nav-default",
    group: "SideNav",
    title: "默认选中：新建对话 + 工作区",
    render: () => <NavCase />,
  },
  {
    id: "nav-automation",
    group: "SideNav",
    title: "默认选中：自动化任务",
    render: () => <NavCase initial="automation" />,
  },
  {
    id: "nav-en",
    group: "SideNav",
    title: "英文（locale=en-US）",
    render: () => <NavCase locale="en-US" />,
  },
];
