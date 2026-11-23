import type { Component } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import { SideNavMenu, type SideNavKey } from "./SideNavMenu";
import { SideNavUser, type SideNavUserData } from "./SideNavUser";
import { SideNavWorkspace, type SideNavWorkspaceRef, type Workspace } from "./SideNavWorkspace";

export interface SideNavProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 当前选中的菜单项，用于高亮。 */
  active?: SideNavKey;
  /** 点击菜单项时回调（通用）。 */
  onSelect?: (key: SideNavKey) => void;
  /** 点击「新建对话」。 */
  onNewChat?: () => void;
  /** 点击「自动化任务」。 */
  onAutomation?: () => void;
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
  onEditWorkspace?: (workspaceId: string) => void;
  onRemoveWorkspace?: (workspaceId: string) => void;
  /** 点击工作区的「新建对话」按钮。 */
  onCreateConversation?: (workspaceId: string) => void;
  /** 点击会话的编辑按钮。 */
  onEditConversation?: (workspaceId: string, conversation: { id: string; title: string }) => void;
  /** 刷新工作区列表。 */
  onRefreshWorkspaces?: () => void;
  /** 刷新指定工作区的对话记录。 */
  onRefreshConversations?: (workspaceId: string) => void;
  /** 标记对话是否正在处理中，用于显示 loading 图标。 */
  isConversationProcessing?: (workspaceId: string, conversationId: string) => boolean;
  /** 获取工作区命令式方法（刷新工作区 / 刷新对话记录）。 */
  onWorkspaceReady?: (ref: SideNavWorkspaceRef) => void;
  /** 底部用户信息。 */
  user?: SideNavUserData;
  /** 点击底部用户栏。 */
  onUserClick?: () => void;
  /** 点击底部设置按钮。 */
  onSettings?: () => void;
  /** 导航栏高度，默认 100vh（当前窗口高度）。 */
  height?: number | string;
  /** 最小高度（px），默认 480。 */
  minHeight?: number;
  /** 最小宽度（px），默认 0。 */
  minWidth?: number;
  class?: string;
}

/**
 * 左侧垂直导航组合组件：`SideNavMenu` + `SideNavWorkspace` + 固定底部 `SideNavUser`。
 *
 * 需要单独使用某一部分时，直接使用对应子组件；它们都可以独立传入 props。
 */
export const SideNav: Component<SideNavProps> = (props) => {
  const height = () => {
    const value = props.height ?? "100vh";
    return typeof value === "number" ? `${value}px` : value;
  };

  return (
  <nav
    aria-label={translate(props.locale ?? DEFAULT_LOCALE, "nav.label", "主导航")}
    class={`flex w-full shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-slate-900/60 ${props.class ?? ""}`}
    style={{
      height: height(),
      "min-height": `${props.minHeight ?? 480}px`,
      "min-width": `${props.minWidth ?? 0}px`,
    }}
  >
    <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
      <SideNavMenu
        locale={props.locale}
        active={props.active}
        onSelect={props.onSelect}
        onNewChat={props.onNewChat}
        onAutomation={props.onAutomation}
      />
      <SideNavWorkspace
        locale={props.locale}
        workspaces={props.workspaces}
        activeConversationId={props.activeConversationId}
        onSelectConversation={props.onSelectConversation}
        onSearch={props.onSearch}
        onCreateWorkspace={props.onCreateWorkspace}
        onEditWorkspace={props.onEditWorkspace}
        onRemoveWorkspace={props.onRemoveWorkspace}
        onCreateConversation={props.onCreateConversation}
        onEditConversation={props.onEditConversation}
        onRefreshWorkspaces={props.onRefreshWorkspaces}
        onRefreshConversations={props.onRefreshConversations}
        isConversationProcessing={props.isConversationProcessing}
        onReady={props.onWorkspaceReady}
      />
    </div>
    <SideNavUser
      locale={props.locale}
      user={props.user}
      onClick={props.onUserClick}
      onSettings={props.onSettings}
    />
  </nav>
  );
};
