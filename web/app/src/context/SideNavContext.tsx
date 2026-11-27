import type { JSX } from "@solidjs/web";

import { SettingsDialog } from "../view/setting/SettingsDialog";

import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type ParentProps,
  type Setter,
} from "solid-js";

export interface SideNavProviderProps extends ParentProps {
  /** 左侧导航内容。 */
  left?: JSX.Element;
  /** 点击新建对话。 */
  onNewConversation?: () => void;
}

interface SideNavContextValue {
  left: Accessor<JSX.Element | undefined>;
  serverOpen: Accessor<boolean>;
  setServerOpen: Setter<boolean>;
  localeOpen: Accessor<boolean>;
  setLocaleOpen: Setter<boolean>;
  exitConfirm: Accessor<boolean>;
  setExitConfirm: Setter<boolean>;
  settingsOpen: Accessor<boolean>;
  setSettingsOpen: Setter<boolean>;
  onNewConversation: () => void;
}

const SideNavContext = createContext<SideNavContextValue>();

/** 左侧导航的弹层状态。 */
export function SideNavProvider(props: SideNavProviderProps) {
  const [serverOpen, setServerOpen] = createSignal(false);
  const [localeOpen, setLocaleOpen] = createSignal(false);
  const [exitConfirm, setExitConfirm] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);

  return (
    <SideNavContext
      value={{
        left: () => props.left,
        serverOpen,
        setServerOpen,
        localeOpen,
        setLocaleOpen,
        exitConfirm,
        setExitConfirm,
        settingsOpen,
        setSettingsOpen,
        onNewConversation: () => props.onNewConversation?.(),
      }}
    >
      {props.children}
      <SettingsDialog
        open={settingsOpen()}
        onOpenChange={setSettingsOpen}
      />
    </SideNavContext>
  );
}

/** 读取左侧导航上下文，必须在 SideNavProvider 内使用。 */
export function useSideNavContext(): SideNavContextValue {
  return useContext(SideNavContext);
}
