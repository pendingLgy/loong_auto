import { For, type Component, type JSX } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

/** 主导航的菜单项标识。 */
export type SideNavKey = "newChat" | "automation";

export interface SideNavMenuProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 当前选中的菜单项，用于高亮。 */
  active?: SideNavKey;
  /** 点击菜单项时回调（通用）。 */
  onSelect?: (key: SideNavKey) => void;
  /** 点击「新建对话」。 */
  onNewChat?: () => void;
  /** 点击「自动化任务」。 */
  onAutomation?: () => void;
  class?: string;
}

function ItemIcon(props: { name: SideNavKey }): JSX.Element {
  return (
    <svg
      class="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.name === "newChat"
        ? <path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.8-5.1A7.5 7.5 0 1 1 20 11.5Z" />
        : <path d="M12 8v4l2.5 2.5M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Z" />}
    </svg>
  );
}

/** 左侧主导航：新建对话、自动化任务。 */
export const SideNavMenu: Component<SideNavMenuProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const handleSelect = (key: SideNavKey) => {
    props.onSelect?.(key);
    if (key === "newChat") {
      props.onNewChat?.();
    } else {
      props.onAutomation?.();
    }
  };

  const items = (): Array<{ key: SideNavKey; label: string }> => [
    { key: "newChat", label: translate(locale(), "nav.newChat", "新建对话") },
    { key: "automation", label: translate(locale(), "nav.automationTasks", "自动化任务") },
  ];

  return (
    <div class={`flex flex-col gap-1 ${props.class ?? ""}`}>
      <For each={items()}>
        {(item) => (
          <button
            type="button"
            onClick={() => handleSelect(item.key)}
            aria-current={props.active === item.key ? "page" : undefined}
            class={`flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-sky-500/40 ${
              props.active === item.key
                ? "bg-blue-500/15 font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                : "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/5"
            }`}
          >
            <ItemIcon name={item.key} />
            <span class="truncate">{item.label}</span>
          </button>
        )}
      </For>
    </div>
  );
};
