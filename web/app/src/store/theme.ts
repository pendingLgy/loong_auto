import { createSignal, type Accessor } from "solid-js";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "loong.web.theme";

function systemTheme(): "light" | "dark" {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readTheme(): ThemeMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system"
      ? value
      : "system";
  } catch {
    return "system";
  }
}

function applyTheme(value: "light" | "dark"): void {
  document.documentElement.classList.toggle("dark", value === "dark");
}

const initialTheme = readTheme();
const [theme, setThemeSignal] = createSignal<ThemeMode>(initialTheme);

applyTheme(initialTheme === "system" ? systemTheme() : initialTheme);

/** 当前主题模式。 */
export {theme};

/** 当前实际生效的浅色 / 深色主题。 */
export const resolvedTheme: Accessor<"light" | "dark"> = () => {
  const value = theme();
  return value === "system" ? systemTheme() : value;
};

/** 设置主题并持久化。 */
export function setTheme(value: ThemeMode): void {
  setThemeSignal(value);
  applyTheme(value === "system" ? systemTheme() : value);
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // 存储不可用时仅保留内存状态。
  }
}

/** 在浅色与深色之间切换。 */
export function toggleTheme(): void {
  setTheme(resolvedTheme() === "dark" ? "light" : "dark");
}
