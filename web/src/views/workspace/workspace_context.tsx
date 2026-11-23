import { createContext, useContext, type Accessor } from "solid-js";

import type { SideNavKey } from "@loong/ui/nav";

import { serverConfig } from "../../storage/server_config";
import { getSessionConfig } from "../../storage/session_config";
import { currentUser } from "../../storage/user";
import { getWorkspaceState } from "../../storage/workspace";

/** HomeView 暴露给中栏子路由的视图状态。 */
export interface WorkspaceViewState {
  active: Accessor<SideNavKey>;
  activeConversationId: Accessor<string>;
}

export const WorkspaceViewContext = createContext<WorkspaceViewState>();

export function useWorkspaceView(): WorkspaceViewState {
  const value = useContext(WorkspaceViewContext);
  if (!value) throw new Error("WorkspaceViewContext is missing");
  return value;
}

/** WorkspaceView 初始化所需的本地数据。 */
export function useWorkspaceLocalData() {
  return {
    initial: getWorkspaceState(),
    currentUser,
    serverConfig,
  };
}

/** 读取会话保存的模型与供应商；无配置时返回空字符串。 */
export function getSessionModelConfig(sessionId: string): {
  model: string;
  provider: string;
} {
  const config = getSessionConfig(sessionId);
  return {
    model: config.model ?? "",
    provider: config.provider ?? "",
  };
}
