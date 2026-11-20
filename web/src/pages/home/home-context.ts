import { createContext, useContext, type Accessor } from "solid-js";

import type { SideNavKey } from "@loong/ui/nav";

/** HomePage 暴露给中栏子路由的视图状态。 */
export interface HomeViewState {
  active: Accessor<SideNavKey>;
  activeConversationId: Accessor<string>;
}

export const HomeViewContext = createContext<HomeViewState>();

export function useHomeView(): HomeViewState {
  const value = useContext(HomeViewContext);
  if (!value) throw new Error("HomeViewContext is missing");
  return value;
}
