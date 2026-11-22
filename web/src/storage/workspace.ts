import type { LayoutState } from "@loong/ui/layout";
import type { SideNavKey, Workspace } from "@loong/ui/nav";

/** 单服务器的工作区界面状态。 */
export interface WorkspaceState {
  layout: LayoutState;
  active: SideNavKey;
  workspaces: Workspace[];
  activeConversationId: string;
  selectedModel: string;
  selectedProvider: string;
}

const STORAGE_KEY = "loong.web.workspace";

const DEFAULT_LAYOUT: LayoutState = {
  leftWidth: 300,
  rightWidth: 300,
  leftCollapsed: false,
  rightCollapsed: true,
};

const DEFAULT_STATE: WorkspaceState = {
  layout: DEFAULT_LAYOUT,
  active: "newChat",
  workspaces: [],
  activeConversationId: "",
  selectedModel: "",
  selectedProvider: "",
};

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

function normalizeState(value: unknown): WorkspaceState {
  const parsed = typeof value === "object" && value !== null
    ? value as Partial<WorkspaceState>
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

/** 读取工作区界面状态。 */
export function getWorkspaceState(): WorkspaceState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : normalizeState(DEFAULT_STATE);
  } catch {
    return normalizeState(DEFAULT_STATE);
  }
}

/** 保存工作区界面状态。 */
export function saveWorkspaceState(state: WorkspaceState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}


/** 清除工作区界面状态。 */
export function clearWorkspaceState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略存储异常。
  }
}
