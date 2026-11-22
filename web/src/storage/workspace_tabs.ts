/** HomeTabs 中的工作区 / 会话标签及持久化。 */
export interface WorkspaceChatTab {
  key: string;
  label: string;
  workspaceId: string;
  workspaceName: string;
  conversationId: string;
  conversationTitle: string;
}

export interface WorkspaceTabsState {
  tabs: WorkspaceChatTab[];
  activeKey: string;
}

export function workspaceTabKey(workspaceId: string, conversationId: string): string {
  return `${workspaceId}:${conversationId}`;
}

const STORAGE_KEY = "loong.web.workspace-tabs";

const EMPTY_STATE: WorkspaceTabsState = { tabs: [], activeKey: "" };

function normalizeTab(value: unknown): WorkspaceChatTab | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Partial<WorkspaceChatTab>;
  if (typeof item.key !== "string" || !item.key) return null;
  if (typeof item.label !== "string" || !item.label) return null;
  if (typeof item.workspaceId !== "string" || !item.workspaceId) return null;
  if (typeof item.workspaceName !== "string") return null;
  if (typeof item.conversationId !== "string" || !item.conversationId) return null;
  if (typeof item.conversationTitle !== "string") return null;

  return {
    key: item.key,
    label: item.label,
    workspaceId: item.workspaceId,
    workspaceName: item.workspaceName,
    conversationId: item.conversationId,
    conversationTitle: item.conversationTitle,
  };
}

/** 读取已打开的标签与激活标签。 */
export function getWorkspaceTabs(): WorkspaceTabsState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_STATE;

    const data = parsed as { tabs?: unknown; activeKey?: unknown };
    const tabs = Array.isArray(data.tabs)
      ? data.tabs.map(normalizeTab).filter((tab): tab is WorkspaceChatTab => tab !== null)
      : [];
    const requested = typeof data.activeKey === "string" ? data.activeKey : "";
    const activeKey = tabs.some((tab) => tab.key === requested)
      ? requested
      : tabs[0]?.key ?? "";

    return { tabs, activeKey };
  } catch {
    return EMPTY_STATE;
  }
}

/** 保存已打开的标签与激活标签。 */
export function saveWorkspaceTabs(tabs: WorkspaceChatTab[], activeKey: string): void {
  try {
    if (tabs.length === 0 && !activeKey) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeKey }));
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}


/** 清除已打开的标签。 */
export function clearWorkspaceTabs(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略存储异常。
  }
}
