import { createSignal } from "solid-js";

const STORAGE_KEY = "loong.web.pinned-tabs";

function readPinnedTabs(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

const [pinnedTabKeys, setPinnedTabKeysSignal] = createSignal<string[]>(readPinnedTabs());

/** 已固定的标签 key 列表。 */
export { pinnedTabKeys };

/** 保存固定标签列表。 */
export function setPinnedTabKeys(keys: string[]): void {
  setPinnedTabKeysSignal(keys);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // 存储不可用时仅当前页面生效。
  }
}
