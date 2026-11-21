import { createSignal } from "solid-js";

const [authExpired, setAuthExpired] = createSignal(false);

/** 是否刚刚发生登录过期（用于全局提示）。 */
export { authExpired };

/** 标记登录已过期。 */
export function markAuthExpired(): void {
  setAuthExpired(true);
}

/** 清除登录过期提示。 */
export function clearAuthExpired(): void {
  setAuthExpired(false);
}
