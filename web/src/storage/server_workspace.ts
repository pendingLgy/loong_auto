import type { LayoutState } from "@loong/ui/layout";
import type { SideNavKey, Workspace } from "@loong/ui/nav";

/** 单个服务器的工作区界面状态。 */
export interface ServerWorkspaceState {
  layout: LayoutState;
  active: SideNavKey;
  workspaces: Workspace[];
  activeConversationId: string;
  selectedModel: string;
  selectedProvider: string;
}

const STORAGE_KEY_PREFIX = "loong.web.server-workspace";

const DEFAULT_LAYOUT: LayoutState = {
  leftWidth: 300,
  rightWidth: 300,
  leftCollapsed: false,
  rightCollapsed: true,
};

const DEFAULT_STATE: ServerWorkspaceState = {
  layout: DEFAULT_LAYOUT,
  active: "newChat",
  workspaces: [],
  activeConversationId: "",
  selectedModel: "",
  selectedProvider: "",
};

function storageKey(serverId: string): string {
  return `${STORAGE_KEY_PREFIX}:${serverId}`;
}

function normalizeLayout(value: unknown): LayoutState {
  const parsed = typeof value === "object" && value !== null
    ? value as Partial<LayoutState>
    : {};
  const number = (candidate: unknown, fallback: number) =>
    typeof candidate === "number" && Number.isFinite(candidate) ? candidate : fallback;

  return {
    leftWidth: number(parsed.leftWidth, DEFAULT_LAYOUT.leftWidth),
    rightWidth: number(parsed.rightWidth, DEFAULT_LAYOUT.rightWidth),
    leftCollapsed: parsed.leftCollapsed === true,
    rightCollapsed: parsed.rightCollapsed === true,
  };
}

function normalizeWorkspaces(value: unknown): Workspace[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const workspace = item as Partial<Workspace>;
    if (typeof workspace.id !== "string" || !workspace.id) return [];
    const conversations = Array.isArray(workspace.conversations)
      ? workspace.conversations.flatMap((conversation) => {
        if (typeof conversation !== "object" || conversation === null) return [];
        const entry = conversation as { id?: unknown; title?: unknown };
        if (typeof entry.id !== "string" || !entry.id) return [];
        return [{
          id: entry.id,
          title: typeof entry.title === "string" ? entry.title : "新的对话",
        }];
      })
      : [];
    return [{
      id: workspace.id,
      name: typeof workspace.name === "string" ? workspace.name : "未命名工作区",
      conversations,
    }];
  });
}

function normalizeState(value: unknown): ServerWorkspaceState {
  const parsed = typeof value === "object" && value !== null
    ? value as Partial<ServerWorkspaceState>
    : {};

  return {
    layout: normalizeLayout(parsed.layout),
    active: parsed.active === "automation" ? "automation" : "newChat",
    workspaces: normalizeWorkspaces(parsed.workspaces),
    activeConversationId: typeof parsed.activeConversationId === "string"
      ? parsed.activeConversationId
      : "",
    selectedModel: typeof parsed.selectedModel === "string" ? parsed.selectedModel : "",
    selectedProvider: typeof parsed.selectedProvider === "string" ? parsed.selectedProvider : "",
  };
}

/** 读取指定服务器的工作区界面状态。 */
export function getServerWorkspaceState(serverId: string): ServerWorkspaceState {
  if (!serverId) return normalizeState(DEFAULT_STATE);
  try {
    const raw = window.localStorage.getItem(storageKey(serverId));
    return raw ? normalizeState(JSON.parse(raw)) : normalizeState(DEFAULT_STATE);
  } catch {
    return normalizeState(DEFAULT_STATE);
  }
}

/** 保存指定服务器的工作区界面状态。 */
export function saveServerWorkspaceState(serverId: string, state: ServerWorkspaceState): void {
  if (!serverId) return;
  try {
    window.localStorage.setItem(storageKey(serverId), JSON.stringify(state));
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}
