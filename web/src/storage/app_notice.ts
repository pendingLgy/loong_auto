import { createSignal } from "solid-js";

import type { MessageType } from "@loong/ui/message";

export interface AppNotice {
  type: MessageType;
  text: string;
}

const [notice, setNotice] = createSignal<AppNotice | null>(null);

/** 当前全局操作提示。 */
export { notice };

/** 显示全局操作提示。 */
export function showNotice(type: MessageType, text: string): void {
  setNotice({ type, text });
}

/** 清除全局操作提示。 */
export function clearNotice(): void {
  setNotice(null);
}
