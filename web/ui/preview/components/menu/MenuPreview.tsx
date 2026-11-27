import { Show, createEffect, createSignal } from "solid-js";

import { Menu, type MenuItem } from "../../../src";
import type { MenuCategory } from "../../types";
import { MenuPropsDoc } from "./MenuPropsDoc";

export interface MenuPreviewProps {
  category: MenuCategory;
}

const STORAGE_KEY = "loong.ui.preview.menu";

interface SavedMenuState {
  selected?: Partial<Record<MenuCategory, string>>;
  expandedKeys?: string[];
}

function readMenuState(): SavedMenuState | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as SavedMenuState : null;
  } catch {
    return null;
  }
}

const menuSets: Record<MenuCategory, MenuItem[]> = {
  basic: [
    {key: "profile", label: "个人信息"},
    {key: "password", label: "修改密码"},
    {
      key: "notifications",
      slot: (
        <span class="flex w-full items-center justify-between gap-2">
          通知
          <span class="rounded-full bg-indigo-100 px-1.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
            3
          </span>
        </span>
      ),
    },
    {
      key: "settings",
      label: "设置",
      children: [
        {key: "general", label: "通用"},
        {key: "advanced", label: "高级"},
      ],
    },
  ],
  default: [
    {
      key: "workspace",
      label: "工作区",
      children: [
        {
          key: "project",
          label: "项目",
          children: [
            {key: "frontend", label: "前端"},
            {key: "backend", label: "后端"},
          ],
        },
        {
          key: "team",
          label: "团队",
          children: [
            {key: "members", label: "成员"},
            {key: "roles", label: "角色"},
          ],
        },
      ],
    },
    {
      key: "settings",
      label: "设置",
      children: [
        {
          key: "account",
          label: "账户",
          children: [
            {key: "profile-detail", label: "个人资料"},
            {key: "security", label: "安全"},
          ],
        },
      ],
    },
  ],
  states: [
    {key: "profile", label: "选中项"},
    {key: "password", label: "普通项"},
    {key: "disabled", label: "不可用项", disabled: true},
  ],
  danger: [
    {key: "logout", label: "退出登录", danger: true},
    {key: "delete", label: "删除账户", danger: true},
    {key: "cancel", label: "取消"},
  ],
  props: [],
  nested: [
    {
      key: "system",
      label: "系统设置",
      children: [
        {
          key: "account",
          label: "账户",
          children: [
            {
              key: "security",
              label: "安全",
              children: [
                {key: "devices", label: "登录设备"},
                {key: "audit", label: "访问记录"},
                {key: "recovery", label: "恢复选项"},
              ],
            },
          ],
        },
      ],
    },
  ],
};

function parentKeys(items: MenuItem[]): string[] {
  return items.flatMap((item) => item.children?.length
    ? [item.key, ...parentKeys(item.children)]
    : []);
}

function firstLeaf(items: MenuItem[]): string {
  for (const item of items) {
    if (!item.children?.length) return item.key;
    const child = firstLeaf(item.children);
    if (child) return child;
  }
  return "";
}

/** Menu 组件预览：场景、尺寸与交互状态。 */
export function MenuPreview(props: MenuPreviewProps) {
  const saved = readMenuState();
  const [selected, setSelected] = createSignal<Record<MenuCategory, string>>({
    basic: "general",
    default: "profile-detail",
    states: firstLeaf(menuSets.states),
    danger: firstLeaf(menuSets.danger),
    nested: "devices",
    props: "",
    ...saved?.selected,
  });
  const [menuWidth, setMenuWidth] = createSignal(224);
  const [menuHeight, setMenuHeight] = createSignal(144);
  const allParentKeys = Object.values(menuSets).flatMap(parentKeys);
  const [expandedKeys, setExpandedKeys] = createSignal(saved?.expandedKeys ?? ["settings"]);

  createEffect(
    () => ({selected: selected(), expandedKeys: expandedKeys()}),
    (state) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
  );

  const selectedPath = (items: MenuItem[], key: string): string[] => {
    for (const item of items) {
      if (item.key === key) return [item.key];
      if (item.children?.length) {
        const child = selectedPath(item.children, key);
        if (child.length) return [item.key, ...child];
      }
    }
    return [];
  };

  createEffect(
    () => ({category: props.category, key: selected()[props.category]}),
    ({category, key}) => {
      const path = selectedPath(menuSets[category], key).slice(0, -1);
      setExpandedKeys((current) => [...new Set([...current, ...path])]);
    },
  );

  const menuValue = () => selected()[props.category];
  const select = (key: string) => setSelected((current) => ({
    ...current,
    [props.category]: key,
  }));

  return (
    <Show when={props.category !== "props"} fallback={<MenuPropsDoc />}>
      <div class="grid gap-5">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          Menu
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          纵向菜单、子菜单、插槽、选中态、禁用项与危险操作。
        </p>
      </div>

      <div class="grid gap-3 rounded-lg border border-dashed border-slate-200 p-4 dark:border-slate-700">
        <div class="flex flex-wrap items-center gap-4 text-[12px] text-slate-500 dark:text-slate-400">
          <label class="flex items-center gap-2">
            宽度 {menuWidth()}px
            <input
              type="range"
              min="120"
              max="400"
              value={menuWidth()}
              onInput={(event) => setMenuWidth(Number(event.currentTarget.value))}
              class="w-32 accent-indigo-500"
            />
          </label>
          <label class="flex items-center gap-2">
            高度 {menuHeight()}px
            <input
              type="range"
              min="80"
              max="320"
              value={menuHeight()}
              onInput={(event) => setMenuHeight(Number(event.currentTarget.value))}
              class="w-32 accent-indigo-500"
            />
          </label>
          <div class="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => setExpandedKeys(allParentKeys)}
              class="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              全部展开
            </button>
            <button
              type="button"
              onClick={() => setExpandedKeys([])}
              class="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              全部折叠
            </button>
          </div>
        </div>

        <Menu
          items={menuSets[props.category]}
          value={menuValue()}
          onSelect={select}
          expandedKeys={expandedKeys()}
          onExpandedChange={setExpandedKeys}
          width={menuWidth()}
          height={menuHeight()}
        />

        <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
          当前选中：{menuValue()}
        </p>
      </div>

      <div class="grid gap-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <p class="m-0 text-[12px] font-medium text-slate-600 dark:text-slate-300">
          场景说明
        </p>
        <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
          左侧切换基础、状态、危险操作与四级子菜单场景；拖拽滑杆调整组件宽高。
        </p>
      </div>
      </div>
    </Show>
  );
}
