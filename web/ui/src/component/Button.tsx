import type { JSX } from "@solidjs/web";

export interface ButtonProps {
  children?: JSX.Element;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
}

/** 基础按钮，颜色来自 UI 主题 token。 */
export function Button(props: ButtonProps) {
  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled}
      onClick={props.onClick}
      class="inline-flex h-9 items-center justify-center rounded-md bg-indigo-500 px-4 text-[13px] font-medium text-white outline-none transition-colors duration-150 hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {props.children}
    </button>
  );
}
