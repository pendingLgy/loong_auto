import { For, createSignal } from "solid-js";

import { ThreePaneLayout, type LayoutState } from "@loong/ui/layout";
import { serverConfig } from "../storage/server_config";
import { getLayoutState, saveLayoutState } from "../storage/settings";
import { clearUser, userSession } from "../storage/user";

const NAV_ITEMS = ["会话", "工具", "设置"];

/** 登录后的首页：左中右布局，布局状态保存到 storage/settings.ts，下次打开优先读取。 */
export function HomePage() {
  const [layout, setLayout] = createSignal<LayoutState>(getLayoutState());
  const [active, setActive] = createSignal(NAV_ITEMS[0]);

  const onLayoutChange = (next: LayoutState) => {
    setLayout(next);
    saveLayoutState(next);
  };

  return (
    <ThreePaneLayout
      value={layout()}
      onChange={onLayoutChange}
      toolbar={
        <div class="flex min-w-0 items-center justify-between gap-3">
          <span class="truncate text-sm font-medium">Home</span>
          <div class="flex min-w-0 items-center gap-2">
            <span class="truncate text-xs text-slate-500 dark:text-slate-400">
              {userSession()?.user.username ?? ""}
            </span>
            <button
              type="button"
              onClick={() => clearUser()}
              class="shrink-0 rounded-md px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              退出
            </button>
          </div>
        </div>
      }
      left={
        <nav class="grid gap-1 p-3" aria-label="主导航">
          <For each={NAV_ITEMS}>
            {(item) => (
              <button
                type="button"
                onClick={() => setActive(item)}
                aria-current={active() === item ? "page" : undefined}
                class={`rounded-lg px-2 py-1.5 text-left text-sm transition ${
                  active() === item
                    ? "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                    : "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                {item}
              </button>
            )}
          </For>
        </nav>
      }
      right={
        <div class="grid gap-2 p-3">
          <h2 class="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">详情</h2>
          <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
            服务器：{serverConfig()?.serverUrl ?? "未配置"}
          </p>
          <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
            选中左侧条目后，这里展示对应的工具与审批信息。
          </p>
        </div>
      }
    >
      <div class="grid gap-3 p-6">
        <h1 class="m-0 text-xl font-semibold">Home</h1>
        <p class="m-0 max-w-prose text-sm text-slate-500 dark:text-slate-400">
          当前分区：{active()}。左右栏可拖动或折叠，布局状态会保存到本地设置，
          下次打开自动恢复。
        </p>
      </div>
    </ThreePaneLayout>
  );
}
