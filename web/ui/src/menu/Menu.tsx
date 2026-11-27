import { For, Show, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";

export interface MenuItem {
  /** 菜单项唯一标识。 */
  key: string;
  label?: string;
  icon?: JSX.Element;
  /** 自定义内容插槽，优先于 label。 */
  slot?: JSX.Element;
  disabled?: boolean;
  /** 子菜单。 */
  children?: MenuItem[];
  /** 追加到该菜单项按钮的 Tailwind 类。 */
  itemClass?: string;
}

export interface MenuProps {
  items: MenuItem[];
  /** 当前选中项。 */
  value?: string;
  onSelect?: (key: string) => void;
  /** 默认展开的子菜单 key。 */
  defaultExpandedKeys?: string[];
  /** 受控展开的子菜单 key。 */
  expandedKeys?: string[];
  onExpandedChange?: (keys: string[]) => void;
  /** 菜单宽度，数字按 px 处理。 */
  width?: string | number;
  /** 菜单高度，数字按 px 处理；超出时滚动。 */
  height?: string | number;
  /** 追加到菜单容器的 Tailwind 类。 */
  class?: string;
}

function size(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

function pathTo(items: MenuItem[], key: string): string[] | null {
  for (const item of items) {
    if (item.key === key) return [item.key];
    if (item.children?.length) {
      const childPath = pathTo(item.children, key);
      if (childPath) return [item.key, ...childPath];
    }
  }
  return null;
}

interface MenuLevelProps {
  items: MenuItem[];
  value?: string;
  onSelect?: (key: string) => void;
  expanded: () => string[];
  onToggle: (key: string) => void;
}

function MenuLevel(props: MenuLevelProps) {
  return (
    <For each={props.items}>
      {(item) => {
        const children = () => item.children ?? [];
        const hasChildren = () => children().length > 0;
        const open = () => props.expanded().includes(item.key);
        const activate = () => {
          if (item.disabled) return;
          if (hasChildren()) props.onToggle(item.key);
          else props.onSelect?.(item.key);
        };

        return (
          <>
            <div
              role="menuitem"
              tabindex={item.disabled ? undefined : 0}
              aria-disabled={item.disabled ? "true" : undefined}
              aria-current={props.value === item.key ? "page" : undefined}
              aria-haspopup={hasChildren() ? "menu" : undefined}
              aria-expanded={hasChildren() ? (open() ? "true" : "false") : undefined}
              onClick={activate}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                activate();
              }}
              class={`flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                item.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
              } ${
                props.value === item.key
                  ? "bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              } ${item.itemClass ?? ""}`}
            >
              <Show when={item.icon}>
                <span class="grid h-4 w-4 shrink-0 place-items-center" aria-hidden="true">
                  {item.icon}
                </span>
              </Show>
              <Show
                when={item.slot}
                fallback={<span class="truncate">{item.label}</span>}
              >
                <span class="min-w-0 flex-1">{item.slot}</span>
              </Show>
              <Show when={hasChildren()}>
                <span class="ml-auto shrink-0 text-[10px] opacity-60" aria-hidden="true">
                  {open() ? "▾" : "▸"}
                </span>
              </Show>
            </div>

            <Show when={hasChildren() && open()}>
              <div
                role="menu"
                class="ml-2 grid gap-0.5 border-l border-slate-200 pl-2 dark:border-slate-700"
              >
                <MenuLevel
                  items={children()}
                  value={props.value}
                  onSelect={props.onSelect}
                  expanded={props.expanded}
                  onToggle={props.onToggle}
                />
              </div>
            </Show>
          </>
        );
      }}
    </For>
  );
}

/** 纵向菜单，支持图标、多级子菜单、选中态与禁用项。 */
export function Menu(props: MenuProps) {
  const initialPath = props.value ? pathTo(props.items, props.value) ?? [] : [];
  const [internalExpanded, setInternalExpanded] = createSignal<string[]>([
    ...new Set([...(props.defaultExpandedKeys ?? []), ...initialPath]),
  ]);
  const expandedKeys = () => props.expandedKeys ?? internalExpanded();

  const updateExpanded = (next: string[]) => {
    if (props.expandedKeys === undefined) setInternalExpanded(next);
    props.onExpandedChange?.(next);
  };

  const expand = (keys: string[]) => {
    const current = expandedKeys();
    const next = new Set(current);
    keys.forEach((key) => next.add(key));
    if (next.size !== current.length) updateExpanded([...next]);
  };

  const toggle = (key: string) => {
    const current = expandedKeys();
    updateExpanded(current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  };

  const select = (key: string) => {
    const path = pathTo(props.items, key);
    if (path) expand(path);
    props.onSelect?.(key);
  };


  return (
    <div
      role="menu"
      aria-orientation="vertical"
      style={{
        width: size(props.width),
        height: size(props.height),
      }}
      class={`flex flex-col gap-0.5 overflow-y-auto ${props.class ?? ""}`}
    >
      <MenuLevel
        items={props.items}
        value={props.value}
        onSelect={select}
        expanded={expandedKeys}
        onToggle={toggle}
      />
    </div>
  );
}
