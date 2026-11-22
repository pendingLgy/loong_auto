import { Show, createEffect, createSignal } from "solid-js";

import { Effect } from "effect";

import { createLocalClient } from "@loong/client";
import { Dialog } from "@loong/ui/dialog";
import { DEFAULT_LOCALE } from "@loong/ui/i18n";
import { HomeTabs } from "@loong/ui/home-tabs";
import { createApiClient } from "../../api";
import { clearServerWebStorage} from "../../storage/reset";
import { clearWorkspaceState } from "../../storage/workspace";
import { clearWorkspaceTabs } from "../../storage/workspace_tabs";
import { showNotice } from "../../storage/app_notice";
import { isServerConfigured, serverConfig, updateServerStatus } from "../../storage/server_config";
import { theme, toggleTheme } from "../../storage/theme";
import { isLoggedIn } from "../../storage/user";
import { WorkspaceView } from "../workspace/WorkspaceView";
import { getWorkspaceTabs, saveWorkspaceTabs } from "../../storage/workspace_tabs";
import type { WorkspaceChatTab } from "../workspace/types";
import { LoginView } from "./LoginView";

/** 根页面：承载唯一服务器的工作区与登录弹窗。 */
export function HomeView() {
  const [logoutOpen, setLogoutOpen] = createSignal(false);
  const [infoOpen, setInfoOpen] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const initialTabs = getWorkspaceTabs();
  const [tabs, setTabs] = createSignal<WorkspaceChatTab[]>(initialTabs.tabs);
  const [activeTab, setActiveTab] = createSignal(initialTabs.activeKey);

  createEffect(() => {
    saveWorkspaceTabs(tabs(), activeTab());
  });

  const logout = async () => {
    try {
      await Effect.runPromise(createApiClient().auth.logout());
    } catch {
      // 注销失败也清除本地登录缓存。
    } finally {
      setTabs([]);
      setActiveTab("");
      clearServerWebStorage();
      // 防止 WorkspaceView 的响应式保存把工作区重新写回。
      queueMicrotask(() => {
        clearWorkspaceState();
        clearWorkspaceTabs();
      });
    }
  };

  const serverLabel = () => {
    const config = serverConfig();
    return config?.name?.trim() || config?.serverUrl || "未配置服务器";
  };

  const needsLogin = () => isServerConfigured() && !isLoggedIn();

  const openTab = (tab: WorkspaceChatTab) => {
    setTabs((current) => {
      const exists = current.some((item) => item.key === tab.key);
      return exists
        ? current.map((item) => item.key === tab.key ? {...item, ...tab} : item)
        : [...current, tab];
    });
    setActiveTab(tab.key);
  };

  const selectTab = (key: string) => {
    setActiveTab(key);
  };

  const closeTab = (key: string) => {
    const current = tabs();
    const index = current.findIndex((tab) => tab.key === key);
    if (index === -1) return;

    const next = current.filter((tab) => tab.key !== key);
    setTabs(next);
    if (activeTab() === key) {
      setActiveTab(next[Math.min(index, next.length - 1)]?.key ?? "");
    }
  };

  const testConnection = async () => {
    const config = serverConfig();
    if (!config || testing()) return;

    setTesting(true);
    try {
      const client = createLocalClient({
        origin: config.serverUrl,
        locale: DEFAULT_LOCALE,
        security_token: config.token,
      });
      await Effect.runPromise(client.health.security_token());
      updateServerStatus(true);
      showNotice("success", `${serverLabel()} 连接正常`);
    } catch {
      updateServerStatus(false);
      showNotice("error", `${serverLabel()} 连接失败`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div class="grid h-screen grid-rows-[auto_minmax(0,1fr)] bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <HomeTabs
        tabs={tabs().map((tab) => ({key: tab.key, label: tab.label}))}
        active={activeTab()}
        onSelect={selectTab}
        onClose={closeTab}
        onAdd={() => undefined}
        onServerInfo={() => setInfoOpen(true)}
        onLogout={() => setLogoutOpen(true)}
        dark={theme() === "dark"}
        onToggleTheme={toggleTheme}
      />

      <div class="relative min-h-0">
        <Show when={isLoggedIn()}>
          <WorkspaceView
            tabs={tabs()}
            activeTabKey={activeTab()}
            onOpenConversation={openTab}
          />
        </Show>

        <Show when={needsLogin()}>
          <LoginView serverName={serverLabel()} />
        </Show>
      </div>

      <Dialog
        open={infoOpen()}
        onClose={() => setInfoOpen(false)}
        size="sm"
        header={
          <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
            服务器信息
          </h2>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              disabled={testing()}
              class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={() => void testConnection()}
              disabled={testing()}
              class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
            >
              {testing() ? "测试中…" : "测试连接"}
            </button>
          </>
        }
      >
        <div class="grid gap-3 text-sm">
          <div class="grid gap-0.5">
            <span class="text-[11px] text-slate-500 dark:text-slate-400">名称</span>
            <span class="break-all text-slate-700 dark:text-slate-200">
              {serverConfig()?.name?.trim() || "未命名服务器"}
            </span>
          </div>
          <div class="grid gap-0.5">
            <span class="text-[11px] text-slate-500 dark:text-slate-400">地址</span>
            <span class="break-all text-slate-700 dark:text-slate-200">
              {serverConfig()?.serverUrl}
            </span>
          </div>
          <div class="grid gap-0.5">
            <span class="text-[11px] text-slate-500 dark:text-slate-400">连接状态</span>
            <span class="text-slate-700 dark:text-slate-200">
              {serverConfig()?.connected === true
                ? "正常"
                : serverConfig()?.connected === false
                  ? "失败"
                  : "未检测"}
            </span>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={logoutOpen()}
        onClose={() => setLogoutOpen(false)}
        size="sm"
        header={
          <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
            退出服务器
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
          确认退出当前服务器？
        </p>
      </Dialog>
    </div>
  );
}
