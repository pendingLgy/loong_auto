import type {Accessor, ParentProps} from "solid-js";

import {
  resolvedTheme,
  setTheme,
  theme,
  toggleTheme,
  type ThemeMode,
} from "../store/theme";
import { createSimpleContext } from "./ContextHelper";

export type { ThemeMode };

export interface GlobalContextValue {
  theme: Accessor<ThemeMode>;
  resolvedTheme: Accessor<"light" | "dark">;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const globalCtx  = createSimpleContext<GlobalContextValue>({
  name: "GlobalContext",
  gate: false,
  init: (props: ParentProps) => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  }),
});


export const useGlobalContext = globalCtx.use
export const GlobalProvider = globalCtx.provider

