import { createSignal } from "solid-js";

const STORAGE_KEY = "loong.web.active-tab";

function readActiveTab(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const [activeTabKey, setActiveTabKeySignal] = createSignal<string | null>(readActiveTab());

/** 上次激活的标签 key（用于刷新后恢复）。 */
export { activeTabKey };

/** 保存上次激活的标签 key。 */
export function setActiveTabKey(key: string | null): void {
  setActiveTabKeySignal(key);
  try {
    if (key) {
      window.localStorage.setItem(STORAGE_KEY, key);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // 存储不可用时仅当前页面生效。
  }
}
