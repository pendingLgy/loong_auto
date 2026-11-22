import { createContext, useContext, type Accessor } from "solid-js";

import type { SideNavKey } from "@loong/ui/nav";

/** HomePage 暴露给中栏子路由的视图状态。 */
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
