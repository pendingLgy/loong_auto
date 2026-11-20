import { Show, createEffect, createSignal, onCleanup, type Component, type JSX } from "solid-js";

import type { Locale } from "../i18n";
import { Message, type MessageType } from "./Message";

export interface ToastProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 提示类型，默认普通。 */
  type?: MessageType;
  /** 是否显示。 */
  open: boolean;
  /** 自动关闭时间（毫秒），默认 3000；传 0 或负数表示不自动关闭。 */
  duration?: number;
  /** 自动关闭时触发。 */
  onClose?: () => void;
  /** 提示内容。 */
  children?: JSX.Element;
  class?: string;
}

/** 浮动消息提示：固定在页面顶部居中，默认 3 秒后自动关闭。 */
export const Toast: Component<ToastProps> = (props) => {
  const [visible, setVisible] = createSignal(props.open);

  createEffect(() => {
    if (!props.open) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const duration = props.duration ?? 3000;
    if (duration <= 0) return;

    const timer = window.setTimeout(() => {
      setVisible(false);
      props.onClose?.();
    }, duration);
    onCleanup(() => window.clearTimeout(timer));
  });

  return (
    <Show when={visible()}>
      <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div class={`pointer-events-auto w-fit max-w-full ${props.class ?? ""}`}>
          <Message locale={props.locale} type={props.type}>
            {props.children}
          </Message>
        </div>
      </div>
    </Show>
  );
};
