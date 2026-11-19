/** 图标组件通用 props。 */
export interface IconProps {
  /** 覆盖默认尺寸/颜色类。 */
  class?: string;
}

import backIcon from "../assets/icons/BackIcon.svg?raw";
import checkIcon from "../assets/icons/CheckIcon.svg?raw";
import chevronIcon from "../assets/icons/ChevronIcon.svg?raw";
import closeIcon from "../assets/icons/CloseIcon.svg?raw";
import copyIcon from "../assets/icons/CopyIcon.svg?raw";
import flameIcon from "../assets/icons/FlameIcon.svg?raw";
import moreIcon from "../assets/icons/MoreIcon.svg?raw";
import navAutomationIcon from "../assets/icons/NavAutomationIcon.svg?raw";
import navChatIcon from "../assets/icons/NavChatIcon.svg?raw";
import plusIcon from "../assets/icons/PlusIcon.svg?raw";
import searchIcon from "../assets/icons/SearchIcon.svg?raw";
import sendIcon from "../assets/icons/SendIcon.svg?raw";
import settingsIcon from "../assets/icons/SettingsIcon.svg?raw";
import slidersIcon from "../assets/icons/SlidersIcon.svg?raw";
import spinnerIcon from "../assets/icons/SpinnerIcon.svg?raw";
import stopIcon from "../assets/icons/StopIcon.svg?raw";

function createIcon(svg: string, className: string): Node {
  const span = document.createElement("span");
  span.className = className;
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = svg;
  return span;
}

export function SendIcon(props: IconProps = {}): Node {
  return createIcon(sendIcon, `inline-block align-middle ${props.class ?? "h-4 w-4"}`);
}

export function StopIcon(props: IconProps = {}): Node {
  return createIcon(stopIcon, `inline-block align-middle ${props.class ?? "h-4 w-4"}`);
}

export function PlusIcon(props: IconProps = {}): Node {
  return createIcon(plusIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"}`);
}

export function CopyIcon(props: IconProps = {}): Node {
  return createIcon(copyIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"}`);
}

export function CheckIcon(props: IconProps = {}): Node {
  return createIcon(checkIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"}`);
}

export function SlidersIcon(props: IconProps = {}): Node {
  return createIcon(slidersIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"}`);
}

export function BackIcon(props: IconProps = {}): Node {
  return createIcon(backIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"}`);
}

export function SearchIcon(props: IconProps = {}): Node {
  return createIcon(searchIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"} shrink-0`);
}

export function SettingsIcon(props: IconProps = {}): Node {
  return createIcon(settingsIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"}`);
}

export function ChevronIcon(props: IconProps & { expanded: boolean }): Node {
  return createIcon(
    chevronIcon,
    `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"} shrink-0 transition-transform${props.expanded ? " rotate-90" : ""}`,
  );
}

export function SpinnerIcon(props: IconProps = {}): Node {
  return createIcon(spinnerIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"} animate-spin`);
}

export function MoreIcon(props: IconProps = {}): Node {
  return createIcon(moreIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"}`);
}

export function FlameIcon(props: IconProps = {}): Node {
  return createIcon(flameIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"}`);
}

export function CloseIcon(props: IconProps = {}): Node {
  return createIcon(closeIcon, `inline-block align-middle ${props.class ?? "h-3.5 w-3.5"}`);
}

export function NavItemIcon(props: IconProps & { name: "newChat" | "automation" }): Node {
  return createIcon(
    props.name === "newChat" ? navChatIcon : navAutomationIcon,
    `inline-block align-middle ${props.class ?? "h-4 w-4 shrink-0"}`,
  );
}

/** 代码块复制按钮的内联 SVG（用于 innerHTML）。 */
export const copyIconSvg = '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

/** 代码块复制成功后的内联 SVG（用于 innerHTML）。 */
export const checkIconSvg = '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>';
