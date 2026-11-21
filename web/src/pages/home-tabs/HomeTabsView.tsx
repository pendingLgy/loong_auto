import { For, Show, createEffect, createSignal } from "solid-js";

import { Effect } from "effect";

import { Dialog } from "@loong/ui/dialog";
import { HomeTabs } from "@loong/ui/home-tabs";
import { activeTabKey, setActiveTabKey } from "../../storage/active_tab";
import { pinnedTabKeys, setPinnedTabKeys } from "../../storage/pinned_tabs";
import { activeServerId, removeServer, servers, setActiveServer } from "../../storage/server_config";
import { clearUser, isLoggedIn } from "../../storage/user";
import { theme, toggleTheme } from "../../storage/theme";
import { createApiClient } from "../../api";
import { ServerWorkspaceView } from "../server-workspace/ServerWorkspaceView";
import { AddServerDialog } from "./AddServerDialog";
import { ServerInfoDialog } from "./ServerInfoDialog";
import { LoginView } from "./LoginView";

/** 根页面：顶部 HomeTabs 切换服务器，下方承载 ServerWorkspaceView。 */
export function HomeTabsView() {
  const [addOpen, setAddOpen] = createSignal(false);
  const [infoOpen, setInfoOpen] = createSignal(false);
  const [logoutOpen, setLogoutOpen] = createSignal(false);

  // 渲染前恢复上次激活的标签；若对应服务器已不存在，则回退到默认服务器。
  const storedTab = activeTabKey();
  if (storedTab && servers().some((server) => server.id === storedTab)) {
    setActiveServer(storedTab);
  }

  createEffect(() => {
    const active = activeServerId();
    if (active) setActiveTabKey(active);
  });

  const logout = async () => {
    const serverId = activeServerId();
    if (!serverId) return;

    try {
      await Effect.runPromise(createApiClient().auth.logout());
    } catch {
      // 注销失败也清除本地登录缓存与服务器配置。
    } finally {
      clearUser(serverId);
      setPinnedTabKeys(pinnedTabKeys().filter((key) => key !== serverId));
      if (activeTabKey() === serverId) setActiveTabKey(null);
      removeServer(serverId);
    }
  };

  const serverTabs = () =>
    servers().map((server, index) => ({
      key: server.id,
      label: server.name?.trim() || server.serverUrl,
      sort: index,
    }));

  const activeServer = () => servers().find((server) => server.id === activeServerId());
  const needsLogin = () => !!activeServerId() && !isLoggedIn();

  return (
    <div class="grid h-screen grid-rows-[auto_minmax(0,1fr)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <HomeTabs
        tabs={serverTabs()}
        active={activeServerId() ?? ""}
        onSelect={(key) => setActiveServer(key)}
        onAdd={() => setAddOpen(true)}
        onServerInfo={() => setInfoOpen(true)}
        onLogout={() => setLogoutOpen(true)}
        pinnedKeys={pinnedTabKeys()}
        onPinnedChange={setPinnedTabKeys}
        dark={theme() === "dark"}
        onToggleTheme={toggleTheme}
      />

      <div class="relative min-h-0">
        <For each={servers()}>
          {(server) => (
            <div
              class={activeServerId() === server.id ? "h-full min-h-0" : "hidden"}
            >
              <ServerWorkspaceView serverId={server.id} />
            </div>
          )}
        </For>

        <Show when={needsLogin()}>
          <LoginView
            serverId={activeServerId()!}
            serverName={activeServer()?.name?.trim() || activeServer()?.serverUrl}
          />
        </Show>
      </div>

      <Dialog
        open={logoutOpen()}
        onClose={() => setLogoutOpen(false)}
        size="sm"
        header={
          <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
            退出登录
          </h2>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setLogoutOpen(false)}
              class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                setLogoutOpen(false);
                void logout();
              }}
              class="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-500/40"
            >
              退出
            </button>
          </>
        }
      >
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          确认退出当前服务器？退出后将清除该服务器的登录信息与服务器配置，此操作不可撤销。
        </p>
      </Dialog>

      <Show when={addOpen()}>
        <AddServerDialog onClose={() => setAddOpen(false)} />
      </Show>

      <Show when={infoOpen()}>
        <ServerInfoDialog onClose={() => setInfoOpen(false)} />
      </Show>
    </div>
  );
}
