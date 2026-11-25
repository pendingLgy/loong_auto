export type Locale = "zh-CN" | "en-US";

const STORAGE_KEY = "loong.web.locale";

/** 读取持久化的界面语言。 */
export function readLocale(): Locale {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "en-US" || value === "zh-CN" ? value : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

/** 持久化界面语言。 */
export function saveLocale(value: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // 存储不可用时由调用方保留内存状态。
  }
}
