import { createSignal } from "solid-js";

import type { LayoutState } from "@loong/ui/layout";

/** 与 `ThreePaneLayout` 的默认值保持一致；这里不 import 组件模块，避免 storage 依赖 UI 运行时。 */
const DEFAULT_LAYOUT: LayoutState = {
  leftWidth: 300,
  rightWidth: 300,
  leftCollapsed: false,
  rightCollapsed: true,
};

/**
 * 页面设置：目前包含三栏布局（拖动宽度、折叠状态）。
 * 统一保存在 localStorage，下一次打开优先读取这里的数据。
 */
const STORAGE_KEY = "loong.web.settings";

/** 旧版本布局存放位置，读取时自动迁移。 */
const LEGACY_LAYOUT_KEY = "loong.web.layout";

export interface PageSettings {
  layout: LayoutState;
}

function normalizeLayout(value: unknown): LayoutState {
  const parsed = typeof value === "object" && value !== null ? value as Partial<LayoutState> : {};
  const number = (candidate: unknown, fallback: number) =>
    typeof candidate === "number" && Number.isFinite(candidate) ? candidate : fallback;

  return {
    leftWidth: number(parsed.leftWidth, DEFAULT_LAYOUT.leftWidth),
    rightWidth: number(parsed.rightWidth, DEFAULT_LAYOUT.rightWidth),
    leftCollapsed: parsed.leftCollapsed === true,
    rightCollapsed: parsed.rightCollapsed === true,
  };
}

function persist(settings: PageSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 存储不可用时仅保留内存态。
  }
}

function readStoredSettings(): PageSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PageSettings> | null;
      return { layout: normalizeLayout(parsed?.layout) };
    }

    // 兼容旧版本：布局曾保存在 sessionStorage 的 loong.web.layout。
    const legacy = window.sessionStorage.getItem(LEGACY_LAYOUT_KEY);
    if (legacy) {
      const layout = normalizeLayout(JSON.parse(legacy));
      persist({ layout });
      window.sessionStorage.removeItem(LEGACY_LAYOUT_KEY);
      return { layout };
    }
  } catch {
    // 数据损坏时回退默认设置。
  }
  return { layout: { ...DEFAULT_LAYOUT } };
}

const [pageSettings, setPageSettingsSignal] = createSignal<PageSettings>(readStoredSettings());

/** 当前页面设置。 */
export { pageSettings };

/** 读取布局设置（下次打开优先使用已保存数据）。 */
export function getLayoutState(): LayoutState {
  return pageSettings().layout;
}

/** 保存布局：拖动结束或折叠切换时调用。 */
export function saveLayoutState(layout: LayoutState): void {
  savePageSettings({ ...pageSettings(), layout });
}

export function savePageSettings(settings: PageSettings): void {
  setPageSettingsSignal(settings);
  persist(settings);
}
