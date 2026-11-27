import { Show } from "solid-js";

import { PanelIcon } from "../../assets/icons/PanelIcon";
import { useLayoutContext } from "../../context/LayoutContext";
import { ChatPage } from "../chat/ChatPage";
import { SideNavProvider } from "../../context/SideNavContext";
import { SideNav } from "./SideNav";

export interface MainLayoutProps {
  /** 顶部标题。 */
  title?: string;
  /** 右侧区域标题。 */
  rightTitle?: string;
  /** 点击新建对话。 */
  onNewConversation?: () => void;
}

/** 主页面左、中、右三栏布局，支持拖动与折叠。 */
export function MainLayout(props: MainLayoutProps) {
  return <MainLayoutContent {...props} />;
}

function MainLayoutContent(props: MainLayoutProps) {
  const {layout, setLeftOpen, setRightOpen, startResize} = useLayoutContext();
  const left_open = () => layout().left_open;
  const right_width = () => layout().right_width;
  const right_open = () => layout().right_open;

  return (
    <div class="flex h-dvh w-full min-h-0 gap-0 overflow-hidden bg-slate-50 p-2.5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <SideNavProvider onNewConversation={props.onNewConversation}>
        <SideNav />
      </SideNavProvider>

      <Show when={left_open()}>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整左侧导航宽度"
          onPointerDown={(event) => startResize("left", event)}
          class="group flex w-2.5 shrink-0 cursor-col-resize items-center justify-center max-lg:hidden"
        >
          <span class="h-10 w-0.5 rounded-full bg-slate-300 transition-colors group-hover:bg-indigo-400 dark:bg-slate-700" />
        </div>
      </Show>

      <main class="flex min-w-[480px] flex-1 flex-col overflow-hidden rounded-xl bg-white/70 shadow-sm dark:bg-slate-900/60">
        <header class="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div class="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setLeftOpen(!left_open())}
              aria-label={left_open() ? "收起左侧区域" : "展开左侧区域"}
              aria-pressed={left_open() ? "true" : "false"}
              title={left_open() ? "收起左侧区域" : "展开左侧区域"}
              class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <PanelIcon expanded={left_open()} class="h-4 w-4" />
            </button>
            <div class="min-w-0 truncate text-sm font-semibold">
              {props.title ?? "首页"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRightOpen(!right_open())}
            aria-label={right_open() ? "收起右侧区域" : "展开右侧区域"}
            aria-pressed={right_open() ? "true" : "false"}
            title={right_open() ? "收起右侧区域" : "展开右侧区域"}
            class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <PanelIcon expanded={!right_open()} class="h-4 w-4" />
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-hidden">
          <ChatPage />
        </div>
      </main>

      <Show when={right_open()}>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整右侧详情宽度"
          onPointerDown={(event) => startResize("right", event)}
          class="group flex w-2.5 shrink-0 cursor-col-resize items-center justify-center max-lg:hidden"
        >
          <span class="h-10 w-0.5 rounded-full bg-slate-300 transition-colors group-hover:bg-indigo-400 dark:bg-slate-700" />
        </div>
      </Show>

      <aside
        aria-label="右侧详情"
        aria-hidden={right_open() ? "false" : "true"}
        style={{
          width: right_open() ? `${right_width()}px` : "0px",
          "min-width": right_open() ? "240px" : "0px",
        }}
        class={`${right_open() ? "max-lg:hidden lg:flex opacity-100" : "flex opacity-0 pointer-events-none"} shrink-0 flex-col overflow-hidden rounded-xl bg-white/70 shadow-sm transition-[width,min-width,opacity] duration-200 ease-out dark:bg-slate-900/60`}
      >
        <header class="flex h-14 min-w-[240px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 shadow-sm dark:border-slate-800">
          <div class="min-w-0 truncate text-sm font-semibold">
            {props.rightTitle ?? "详情"}
          </div>
        </header>
        <div class="flex min-h-0 min-w-[240px] flex-1 flex-col gap-3 overflow-auto p-4" />
      </aside>
    </div>
  );
}
