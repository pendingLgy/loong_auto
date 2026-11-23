import {type Component, createEffect, createSignal, For, onCleanup, onMount, Show} from "solid-js";

import {BackIcon, CloseIcon, LogoutIcon, MoonIcon, PinIcon, PlusIcon, ServerIcon, SunIcon, UnpinIcon} from "../icon";
import {DEFAULT_LOCALE, type Locale, translate} from "../i18n";

/** 顶部标签页数据。 */
export interface HomeTab {
  key: string;
  label: string;
  /** 排序值，越小越靠前；省略时使用传入顺序。 */
  sort?: number;
}

export interface HomeTabsProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 标签页列表。 */
  tabs?: HomeTab[];
  /** 当前选中的标签 key。 */
  active?: string;
  /** 切换标签。 */
  onSelect?: (key: string) => void;
  /** 点击最左侧「+」。 */
  onAdd?: () => void;
  /** 受控的固定标签 key 列表；提供时由外部维护。 */
  pinnedKeys?: string[];
  /** 固定 / 取消固定后回传完整列表，便于持久化。 */
  onPinnedChange?: (keys: string[]) => void;
  /** 固定某个标签。 */
  onPin?: (key: string) => void;
  /** 取消固定某个标签。 */
  onUnpin?: (key: string) => void;
  /** 点击服务器信息按钮。 */
  onServerInfo?: () => void;
  /** 关闭某个标签。 */
  onClose?: (key: string) => void;
  /** 点击「退出登录」。 */
  onLogout?: () => void;
  /** 当前是否深色主题，用于切换按钮图标。 */
  dark?: boolean;
  /** 点击主题切换按钮。 */
  onToggleTheme?: () => void;
  class?: string;
}

/** 首页顶部导航：左侧「+」、中间标签切换、右侧登录/退出。 */
export const HomeTabs: Component<HomeTabsProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;
  const sortedTabs = () => {
    const list = props.tabs ?? [];
    return list
      .map((tab, index) => ({ tab, index }))
      .sort((a, b) => (a.tab.sort ?? a.index) - (b.tab.sort ?? b.index))
      .map((entry) => entry.tab);
  };

  const [internalPinnedKeys, setInternalPinnedKeys] = createSignal<string[]>([]);
  const pinnedKeys = () => props.pinnedKeys ?? internalPinnedKeys();

  const pinnedTabs = () => {
    const pinned = pinnedKeys();
    if (pinned.length === 0) return [];

    return pinned
      .map((key) => sortedTabs().find((tab) => tab.key === key))
      .filter((tab): tab is HomeTab => tab !== undefined);
  };

  const unpinnedTabs = () => {
    const pinned = pinnedKeys();
    return sortedTabs().filter((tab) => !pinned.includes(tab.key));
  };

  const isPinned = (key: string) => pinnedKeys().includes(key);

  const setPinnedKeys = (next: string[]) => {
    if (!props.pinnedKeys) setInternalPinnedKeys(next);
    props.onPinnedChange?.(next);
  };

  const pinTab = (key: string) => {
    if (isPinned(key)) {
      setPinnedKeys(pinnedKeys().filter((item) => item !== key));
      props.onUnpin?.(key);
      return;
    }

    setPinnedKeys([...pinnedKeys(), key]);
    props.onPin?.(key);
  };

  const pinButton = (tab: HomeTab, placement: string) => (
    <button
      type="button"
      onClick={() => pinTab(tab.key)}
      aria-label={isPinned(tab.key)
        ? translate(locale(), "homeTabs.unpin", "取消固定")
        : translate(locale(), "homeTabs.pin", "固定到最左")}
      title={isPinned(tab.key)
        ? translate(locale(), "homeTabs.unpin", "取消固定")
        : translate(locale(), "homeTabs.pin", "固定到最左")}
      class={`${placement} grid h-6 w-6 shrink-0 place-items-center rounded text-current opacity-60 outline-none transition hover:bg-slate-900/10 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:hover:bg-white/10`}
    >
      {isPinned(tab.key)
        ? <UnpinIcon class="h-3.5 w-3.5" />
        : <PinIcon class="h-3.5 w-3.5" />}
    </button>
  );

  const tabItem = (tab: HomeTab) => (
    <div
      data-tab-key={tab.key}
      class={`group flex h-8 shrink-0 items-center rounded-md text-sm transition ${
        props.active === tab.key
          ? "bg-blue-500/15 font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
          : isPinned(tab.key)
            ? "bg-slate-200/70 text-slate-600 hover:bg-slate-300/70 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
            : "text-slate-500 hover:bg-slate-900/5 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
      }`}
    >
      <Show when={isPinned(tab.key)}>
        {pinButton(tab, "ml-1")}
      </Show>
      <button
        type="button"
        role="tab"
        aria-selected={props.active === tab.key}
        onClick={() => props.onSelect?.(tab.key)}
        class="flex h-full min-w-0 items-center rounded-md px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
      >
        <span class="truncate">{tab.label}</span>
      </button>
      <Show when={props.onClose}>
        <button
          type="button"
          onClick={() => props.onClose?.(tab.key)}
          aria-label={translate(locale(), "homeTabs.close", "关闭")}
          title={translate(locale(), "homeTabs.close", "关闭")}
          class={`mr-1 grid h-6 w-6 shrink-0 place-items-center rounded text-current outline-none transition hover:bg-slate-900/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:hover:bg-white/10 ${props.active === tab.key ? "opacity-60" : "opacity-0 group-hover:opacity-60"}`}
        >
          <CloseIcon class="h-3 w-3" />
        </button>
      </Show>
      <Show when={!isPinned(tab.key) && props.active === tab.key}>
        {pinButton(tab, "mr-1")}
      </Show>
    </div>
  );

  let tablist: HTMLDivElement | undefined;
  const [canScrollLeft, setCanScrollLeft] = createSignal(false);
  const [canScrollRight, setCanScrollRight] = createSignal(false);

  const updateScrollState = () => {
    if (!tablist) return;
    setCanScrollLeft(tablist.scrollLeft > 0);
    setCanScrollRight(tablist.scrollLeft + tablist.clientWidth < tablist.scrollWidth - 1);
  };

  createEffect(() => {
    const key = props.active;
    if (!key || !tablist) return;

    const tab = [...tablist.querySelectorAll<HTMLElement>("[data-tab-key]")]
      .find((element) => element.dataset.tabKey === key);
    if (!tab) return;

    const tabRect = tab.getBoundingClientRect();
    const listRect = tablist.getBoundingClientRect();
    if (tabRect.left < listRect.left) {
      tablist.scrollBy({left: tabRect.left - listRect.left - 8, behavior: "smooth"});
    } else if (tabRect.right > listRect.right) {
      tablist.scrollBy({left: tabRect.right - listRect.right + 8, behavior: "smooth"});
    }
  });

  const scrollTabs = (direction: -1 | 1) => {
    if (!tablist) return;
    const distance = Math.max(160, tablist.clientWidth * 0.6);
    tablist.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  const overflowing = () => canScrollLeft() || canScrollRight();

  onMount(() => {
    updateScrollState();
    if (!tablist) return;

    const observer = new ResizeObserver(() => updateScrollState());
    observer.observe(tablist);
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    sortedTabs();
    pinnedKeys();
    queueMicrotask(updateScrollState);
  });

  return (
    <div
      class={`flex h-11 items-center gap-2 overflow-hidden border-b border-slate-200 bg-white/80 px-2 dark:border-white/10 dark:bg-slate-900/70 ${props.class ?? ""}`}
    >
      <button
        type="button"
        onClick={() => props.onAdd?.()}
        aria-label={translate(locale(), "homeTabs.add", "新建对话")}
        title={translate(locale(), "homeTabs.add", "新建对话")}
        class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
      >
        <PlusIcon class="h-4 w-4" />
      </button>

      <div role="tablist" class="flex min-w-0 flex-1 items-center gap-1">
        <Show when={pinnedTabs().length > 0}>
          <div class="flex shrink-0 items-center gap-1">
            <For each={pinnedTabs()}>{(tab) => tabItem(tab)}</For>
          </div>
        </Show>

        <Show when={overflowing()}>
          <button
            type="button"
            onClick={() => scrollTabs(-1)}
            disabled={!canScrollLeft()}
            aria-label={translate(locale(), "homeTabs.scrollLeft", "向左滚动")}
            title={translate(locale(), "homeTabs.scrollLeft", "向左滚动")}
            class="grid h-7 w-6 shrink-0 place-items-center rounded bg-slate-200/60 text-slate-600 outline-none transition hover:bg-slate-300/70 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15 dark:hover:text-slate-100"
          >
            <BackIcon class="h-3.5 w-3.5" />
          </button>
        </Show>

        <div
          ref={tablist}
          onScroll={updateScrollState}
          class="home-tabs-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-hidden overflow-y-hidden whitespace-nowrap"
        >
          <For each={unpinnedTabs()}>{(tab) => tabItem(tab)}</For>
        </div>

        <Show when={overflowing()}>
          <button
            type="button"
            onClick={() => scrollTabs(1)}
            disabled={!canScrollRight()}
            aria-label={translate(locale(), "homeTabs.scrollRight", "向右滚动")}
            title={translate(locale(), "homeTabs.scrollRight", "向右滚动")}
            class="grid h-7 w-6 shrink-0 place-items-center rounded bg-slate-200/60 text-slate-600 outline-none transition hover:bg-slate-300/70 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15 dark:hover:text-slate-100"
          >
            <BackIcon class="h-3.5 w-3.5 rotate-180" />
          </button>
        </Show>
      </div>

      <div class="flex w-28 shrink-0 items-center justify-end gap-1">

        <button
          type="button"
          onClick={() => props.onToggleTheme?.()}
          aria-label={props.dark
            ? translate(locale(), "homeTabs.lightMode", "切换到浅色模式")
            : translate(locale(), "homeTabs.darkMode", "切换到深色模式")}
          title={props.dark
            ? translate(locale(), "homeTabs.lightMode", "切换到浅色模式")
            : translate(locale(), "homeTabs.darkMode", "切换到深色模式")}
          class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          {props.dark ? <SunIcon class="h-4 w-4"/> : <MoonIcon class="h-4 w-4"/>}
        </button>

        <button
          type="button"
          onClick={() => props.onServerInfo?.()}
          aria-label={translate(locale(), "homeTabs.serverInfo", "服务器信息")}
          title={translate(locale(), "homeTabs.serverInfo", "服务器信息")}
          class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          <ServerIcon class="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => props.onLogout?.()}
          aria-label={translate(locale(), "homeTabs.logout", "退出服务器")}
          title={translate(locale(), "homeTabs.logout", "退出服务器")}
          class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-red-500/10 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-slate-400 dark:hover:bg-red-500/15 dark:hover:text-red-400"
        >
          <LogoutIcon class="h-4 w-4"/>
        </button>

      </div>
    </div>
  );
};
