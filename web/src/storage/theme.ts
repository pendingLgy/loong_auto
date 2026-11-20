import { createSignal } from "solid-js";

/** 主题模式。 */
export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "loong.web.theme";

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

function readStoredTheme(): ThemeMode | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isThemeMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

function systemTheme(): ThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const [theme, setThemeSignal] = createSignal<ThemeMode>(readStoredTheme() ?? systemTheme());

function applyTheme(value: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", value === "dark");
}

/** 当前主题。 */
export { theme };

/** 切换浅色 / 深色主题并持久化。 */
export function toggleTheme(): void {
  const next: ThemeMode = theme() === "dark" ? "light" : "dark";
  setThemeSignal(next);
  applyTheme(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 存储不可用时仅当前页面生效。
  }
}

// 模块加载时应用一次，确保刷新后保持主题。
applyTheme(theme());
