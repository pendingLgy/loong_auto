import { Show, createEffect, onCleanup, type Component, type JSX } from "solid-js";

import { CloseIcon } from "../icon";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

const sizeClass = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
} as const;

export type DialogSize = keyof typeof sizeClass;

export interface DialogProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 是否显示。 */
  open: boolean;
  /** 关闭回调（点击遮罩、关闭按钮或按 Esc 时触发）。 */
  onClose?: () => void;
  /** 头部内容，通常放标题。 */
  header?: JSX.Element;
  /** 内容。 */
  children?: JSX.Element;
  /** 底部内容，通常放操作按钮。 */
  footer?: JSX.Element;
  /** 是否显示关闭按钮，默认 true。 */
  closable?: boolean;
  /** 点击遮罩是否关闭，默认 true。 */
  closeOnOverlay?: boolean;
  /** 遮罩定位类名，默认 fixed inset-0；传入 absolute inset-0 可限制在父容器内。 */
  overlayClass?: string;
  /** 宽度，默认 md。 */
  size?: DialogSize;
  /** 无可见标题时提供的无障碍名称。 */
  ariaLabel?: string;
  class?: string;
  panelClass?: string;
}

/** 通用对话框：遮罩、焦点、Esc 关闭与可选头/底插槽。 */
export const Dialog: Component<DialogProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;
  let panel: HTMLDivElement | undefined;

  createEffect(() => {
    if (!props.open || typeof document === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    queueMicrotask(() => panel?.focus());

    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  const showHeader = () => props.header !== undefined || props.closable !== false;

  return (
    <Show when={props.open}>
      <div
        class={`${props.overlayClass ?? "fixed inset-0"} z-50 grid place-items-center bg-slate-900/40 p-4`}
        role="presentation"
        onClick={() => {
          if (props.closeOnOverlay !== false) props.onClose?.();
        }}
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={props.ariaLabel ?? translate(locale(), "dialog.label", "对话框")}
          tabindex="-1"
          class={`grid w-full gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl outline-none dark:border-white/10 dark:bg-slate-900 ${sizeClass[props.size ?? "md"]} ${props.panelClass ?? ""}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Show when={showHeader()}>
            <header class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">{props.header}</div>
              <Show when={props.closable !== false}>
                <button
                  type="button"
                  onClick={() => props.onClose?.()}
                  aria-label={translate(locale(), "dialog.close", "关闭")}
                  title={translate(locale(), "dialog.close", "关闭")}
                  class="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <CloseIcon class="h-3.5 w-3.5" />
                </button>
              </Show>
            </header>
          </Show>

          <div class="min-w-0">{props.children}</div>

          <Show when={props.footer}>
            <footer class="flex items-center justify-end gap-2">{props.footer}</footer>
          </Show>
        </div>
      </div>
    </Show>
  );
};
