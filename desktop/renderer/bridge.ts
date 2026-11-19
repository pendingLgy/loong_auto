import type { LoginSession } from "../../shared/client/login";

/**
 * `desktop/preload` 通过 `contextBridge` 暴露给渲染进程的最小认证契约。
 *
 * 令牌只交给主进程保存（主进程可用 `safeStorage` 加密落盘），渲染进程的内存里
 * 只保留当前会话，不写 `localStorage` / `sessionStorage`。
 */
export interface LoongAuthBridge {
  saveSession(session: LoginSession): Promise<void>;
  clearSession(): Promise<void>;
}

export interface LoongBridge {
  auth: LoongAuthBridge;
}

declare global {
  interface Window {
    /** 由 desktop/preload 注入；在浏览器里调试渲染进程时可能不存在。 */
    loong?: LoongBridge;
  }
}

export function getAuthBridge(): LoongAuthBridge | undefined {
  return typeof window === "undefined" ? undefined : window.loong?.auth;
}

/** 把登录结果交给主进程；没有 preload 桥时返回 false，由调用方决定后续动作。 */
export async function persistSession(session: LoginSession): Promise<boolean> {
  const bridge = getAuthBridge();
  if (!bridge) {
    return false;
  }
  await bridge.saveSession(session);
  return true;
}
