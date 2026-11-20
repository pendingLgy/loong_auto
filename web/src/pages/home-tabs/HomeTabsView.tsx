import { For, Show, createEffect, createSignal } from "solid-js";

import { HomeTabs } from "@loong/ui/home-tabs";
import { activeTabKey, setActiveTabKey } from "../../storage/active_tab";
import { pinnedTabKeys, setPinnedTabKeys } from "../../storage/pinned_tabs";
import { activeServerId, servers, setActiveServer } from "../../storage/server_config";
import { theme, toggleTheme } from "../../storage/theme";
import { ServerWorkspaceView } from "../server-workspace/ServerWorkspaceView";
import { AddServerDialog } from "./AddServerDialog";
import { ServerInfoDialog } from "./ServerInfoDialog";

/** 根页面：顶部 HomeTabs 切换服务器，下方承载 ServerWorkspaceView。 */
export function HomeTabsView() {
  const [addOpen, setAddOpen] = createSignal(false);
  const [infoOpen, setInfoOpen] = createSignal(false);

  // 渲染前恢复上次激活的标签；若对应服务器已不存在，则回退到默认服务器。
  const storedTab = activeTabKey();
  if (storedTab && servers().some((server) => server.id === storedTab)) {
    setActiveServer(storedTab);
  }

  createEffect(() => {
    const active = activeServerId();
    if (active) setActiveTabKey(active);
  });

  const serverTabs = () =>
    servers().map((server, index) => ({
      key: server.id,
      label: server.name?.trim() || server.serverUrl,
      sort: index,
    }));

  return (
    <div class="grid h-screen grid-rows-[auto_minmax(0,1fr)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <HomeTabs
        tabs={serverTabs()}
        active={activeServerId() ?? ""}
        onSelect={(key) => setActiveServer(key)}
        onAdd={() => setAddOpen(true)}
        onServerInfo={() => setInfoOpen(true)}
        pinnedKeys={pinnedTabKeys()}
        onPinnedChange={setPinnedTabKeys}
        dark={theme() === "dark"}
        onToggleTheme={toggleTheme}
      />

      <For each={servers()}>
        {(server) => (
          <div
            class={activeServerId() === server.id ? "h-full min-h-0" : "hidden"}
          >
            <ServerWorkspaceView serverId={server.id} />
          </div>
        )}
      </For>

      <Show when={addOpen()}>
        <AddServerDialog onClose={() => setAddOpen(false)} />
      </Show>

      <Show when={infoOpen()}>
        <ServerInfoDialog onClose={() => setInfoOpen(false)} />
      </Show>
    </div>
  );
}
