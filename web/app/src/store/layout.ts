export interface LayoutSettings {
  leftWidth: number;
  rightWidth: number;
  leftOpen: boolean;
  rightOpen: boolean;
}

const STORAGE_KEY = "loong.web.layout";

export const DEFAULT_LAYOUT: LayoutSettings = {
  leftWidth: 256,
  rightWidth: 288,
  leftOpen: true,
  rightOpen: true,
};

/** 读取持久化的布局设置。 */
export function readLayout(): LayoutSettings {
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

/** 保存布局设置。 */
export function saveLayout(layout: LayoutSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // 存储不可用时由调用方保留内存状态。
  }
}
