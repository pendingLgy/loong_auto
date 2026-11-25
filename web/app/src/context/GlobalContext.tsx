import { createContext, useContext, type Accessor, type ParentProps } from "solid-js";

import {
  resolvedTheme,
  setTheme,
  theme,
  toggleTheme,
  type ThemeMode,
} from "../store/theme";

export type {ThemeMode};

interface GlobalContextValue {
  theme: Accessor<ThemeMode>;
  resolvedTheme: Accessor<"light" | "dark">;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const GlobalContext = createContext<GlobalContextValue>();

/** 应用级全局上下文；状态与持久化由 store 管理。 */
export function GlobalProvider(props: ParentProps) {
  return (
    <GlobalContext value={{theme, resolvedTheme, setTheme, toggleTheme}}>
      {props.children}
    </GlobalContext>
  );
}

/** 读取全局上下文，必须在 GlobalProvider 内使用。 */
export function useGlobalContext(): GlobalContextValue {
  return useContext(GlobalContext);
}
