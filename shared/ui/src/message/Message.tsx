import { type Component, type JSX } from "solid-js";

import {
  AlertIcon,
  BellIcon,
  ErrorIcon,
  InfoIcon,
  SuccessIcon,
} from "../icon";
import type { Locale } from "../i18n";

/** 消息提示类型。 */
export type MessageType = "primary" | "success" | "warning" | "info" | "error";

export interface MessageProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 提示类型，默认普通。 */
  type?: MessageType;
  /** 提示内容。 */
  children?: JSX.Element;
  class?: string;
}

const containerClass: Record<MessageType, string> = {
  primary: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  info: "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200",
  error: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
};

const iconClass: Record<MessageType, string> = {
  primary: "text-sky-500 dark:text-sky-400",
  success: "text-emerald-500 dark:text-emerald-400",
  warning: "text-amber-500 dark:text-amber-400",
  info: "text-slate-500 dark:text-slate-400",
  error: "text-red-500 dark:text-red-400",
};

/** 消息提示：普通 / 警告 / 危险 / 成功 / 错误。 */
export const Message: Component<MessageProps> = (props) => {
  const type = () => props.type ?? "primary";
  const isAlert = () => type() === "error";

  const icon = () => {
    switch (type()) {
      case "success":
        return <SuccessIcon class="h-4 w-4" />;
      case "warning":
        return <AlertIcon class="h-4 w-4" />;
      case "info":
        return <InfoIcon class="h-4 w-4" />;
      case "error":
        return <ErrorIcon class="h-4 w-4" />;
      default:
        return <BellIcon class="h-4 w-4" />;
    }
  };

  return (
    <div
      role={isAlert() ? "alert" : "status"}
      aria-live={isAlert() ? "assertive" : "polite"}
      class={`flex w-fit max-w-full items-start gap-2 rounded-lg border px-3 py-2 text-sm ${containerClass[type()]} ${props.class ?? ""}`}
    >
      <span class={`flex h-5 w-4 shrink-0 items-center ${iconClass[type()]}`}>{icon()}</span>
      <div class="min-w-0 flex-1 break-words leading-5">{props.children}</div>
    </div>
  );
};
