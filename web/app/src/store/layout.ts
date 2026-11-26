export interface LayoutSettings {
  left_width: number;
  right_width: number;
  left_open: boolean;
  right_open: boolean;
}

const STORAGE_KEY = "loong.web.layout";

export const DEFAULT_LAYOUT: LayoutSettings = {
  left_width: 256,
  right_width: 288,
  left_open: true,
  right_open: true,
};

/** 读取持久化的布局设置。 */
export function readLayout(): LayoutSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<LayoutSettings> | null;
    return {
      left_width: typeof parsed?.left_width === "number"
        ? parsed.left_width
        : DEFAULT_LAYOUT.left_width,
      right_width: typeof parsed?.right_width === "number"
        ? parsed.right_width
        : DEFAULT_LAYOUT.right_width,
      left_open: parsed?.left_open !== false,
      right_open: parsed?.right_open !== false,
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
