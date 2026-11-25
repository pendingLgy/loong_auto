import { createSignal } from "solid-js";

export interface LayoutSettings {
  leftWidth: number;
  rightWidth: number;
  leftOpen: boolean;
  rightOpen: boolean;
}

const STORAGE_KEY = "loong.web.layout";

const DEFAULT_LAYOUT: LayoutSettings = {
  leftWidth: 256,
  rightWidth: 288,
  leftOpen: true,
  rightOpen: true,
};

function readLayout(): LayoutSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<LayoutSettings> | null;
    return {
      leftWidth: typeof parsed?.leftWidth === "number"
        ? parsed.leftWidth
        : DEFAULT_LAYOUT.leftWidth,
      rightWidth: typeof parsed?.rightWidth === "number"
        ? parsed.rightWidth
        : DEFAULT_LAYOUT.rightWidth,
      leftOpen: parsed?.leftOpen !== false,
      rightOpen: parsed?.rightOpen !== false,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

const [layout, setLayoutSignal] = createSignal<LayoutSettings>(readLayout());

/** 当前布局设置。 */
export {layout};

function save(next: LayoutSettings): void {
  setLayoutSignal(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}

/** 更新左侧宽度。 */
export function setLeftWidth(width: number): void {
  save({...layout(), leftWidth: width});
}

/** 更新右侧宽度。 */
export function setRightWidth(width: number): void {
  save({...layout(), rightWidth: width});
}

/** 更新左侧展开状态。 */
export function setLeftOpen(open: boolean): void {
  save({...layout(), leftOpen: open});
}

/** 更新右侧展开状态。 */
export function setRightOpen(open: boolean): void {
  save({...layout(), rightOpen: open});
}
