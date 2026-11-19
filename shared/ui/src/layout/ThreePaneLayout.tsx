import { createEffect, createSignal, on, type Component, type JSX } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

export interface LayoutState {
  /** 左栏宽度（px），折叠时保留，供下次展开恢复。 */
  leftWidth: number;
  /** 右栏宽度（px）。 */
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

export const DEFAULT_LAYOUT_STATE: LayoutState = {
  leftWidth: 240,
  rightWidth: 280,
  leftCollapsed: false,
  rightCollapsed: false,
};

export interface ThreePaneLayoutProps {
  locale?: Locale;
  /** 左栏内容。 */
  left?: JSX.Element;
  /** 右栏内容。 */
  right?: JSX.Element;
  /** 中栏顶部导航栏内容（折叠按钮固定在导航栏两端）。 */
  toolbar?: JSX.Element;
  /** 中栏内容。 */
  children?: JSX.Element;
  /** 组件高度，默认 100vh（当前窗口高度）；嵌入固定容器时可覆盖。 */
  height?: number | string;
  /** 最小高度（px），默认 480；窗口过矮时页面滚动而不是压缩内容。 */
  minHeight?: number;
  /** 当前/初始布局，用于恢复上次保存的折叠与宽度。 */
  value?: LayoutState;
  /** 未提供 value 时使用的默认布局。 */
  defaultState?: LayoutState;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
  /** 折叠切换或拖动结束时回调，调用方据此持久化布局。 */
  onChange?: (state: LayoutState) => void;
  class?: string;
}

type Side = "left" | "right";

const LEFT: Side = "left";
const RIGHT: Side = "right";

/**
 * 左 / 中 / 右三栏布局：左右两栏可折叠、可拖动调整宽度。
 *
 * 中栏顶部有导航栏，左右折叠按钮分别位于导航栏两端；拖动条只负责调整宽度。
 * 组件不负责持久化：折叠或拖动结束时通过 `onChange` 把完整 `LayoutState`
 * 回传给调用方保存，下次打开时再通过 `value` 传入即可恢复。
 */
export const ThreePaneLayout: Component<ThreePaneLayoutProps> = (props) => {
  const [state, setState] = createSignal<LayoutState>({
    ...(props.value ?? props.defaultState ?? DEFAULT_LAYOUT_STATE),
  });
  const [dragging, setDragging] = createSignal<Side | null>(null);
  const [dragOrigin, setDragOrigin] = createSignal({ x: 0, width: 0 });

  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const height = () => {
    const value = props.height ?? "100vh";
    return typeof value === "number" ? `${value}px` : value;
  };

  const minWidth = (side: Side) =>
    side === LEFT ? (props.minLeftWidth ?? 160) : (props.minRightWidth ?? 200);
  const maxWidth = (side: Side) =>
    side === LEFT ? (props.maxLeftWidth ?? 480) : (props.maxRightWidth ?? 560);

  const collapsed = (side: Side) =>
    side === LEFT ? state().leftCollapsed : state().rightCollapsed;
  const width = (side: Side) => side === LEFT ? state().leftWidth : state().rightWidth;

  const clamp = (side: Side, value: number) =>
    Math.min(maxWidth(side), Math.max(minWidth(side), Math.round(value)));

  const patch = (value: Partial<LayoutState>) =>
    setState((current) => ({ ...current, ...value }));

  // 外部恢复配置时同步内部状态。
  createEffect(on(() => props.value, (value) => {
    if (value) setState({ ...value });
  }, { defer: true }));

  const commit = () => props.onChange?.(state());

  const setWidth = (side: Side, value: number) => {
    patch(side === LEFT
      ? { leftWidth: clamp(side, value) }
      : { rightWidth: clamp(side, value) });
  };

  const toggle = (side: Side) => {
    patch(side === LEFT
      ? { leftCollapsed: !state().leftCollapsed }
      : { rightCollapsed: !state().rightCollapsed });
    commit();
  };

  const startDrag = (side: Side) => (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(side);
    setDragOrigin({ x: event.clientX, width: width(side) });
  };

  const moveDrag = (side: Side) => (event: PointerEvent) => {
    if (dragging() !== side) return;
    const origin = dragOrigin();
    const delta = side === LEFT ? event.clientX - origin.x : origin.x - event.clientX;
    setWidth(side, origin.width + delta);
  };

  const endDrag = (side: Side) => (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    if (dragging() !== side) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(null);
    commit();
  };

  const handleKeyDown = (side: Side) => (event: KeyboardEvent) => {
    const step = event.shiftKey ? 48 : 16;
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        setWidth(side, width(side) - step);
        commit();
        break;
      case "ArrowRight":
        event.preventDefault();
        setWidth(side, width(side) + step);
        commit();
        break;
      case "Home":
        event.preventDefault();
        setWidth(side, minWidth(side));
        commit();
        break;
      case "End":
        event.preventDefault();
        setWidth(side, maxWidth(side));
        commit();
        break;
      default:
        break;
    }
  };

  const collapseLabel = (side: Side) => {
    if (collapsed(side)) {
      return side === LEFT
        ? translate(locale(), "layout.expandLeft", "展开左栏")
        : translate(locale(), "layout.expandRight", "展开右栏");
    }
    return side === LEFT
      ? translate(locale(), "layout.collapseLeft", "折叠左栏")
      : translate(locale(), "layout.collapseRight", "折叠右栏");
  };

  const resizeLabel = (side: Side) => side === LEFT
    ? translate(locale(), "layout.resizeLeft", "调整左栏宽度")
    : translate(locale(), "layout.resizeRight", "调整右栏宽度");

  const toggleButton = (side: Side) => (
    <button
      type="button"
      onClick={() => toggle(side)}
      aria-label={collapseLabel(side)}
      aria-pressed={collapsed(side)}
      title={collapseLabel(side)}
      class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
    >
      {side === LEFT
        ? (collapsed(LEFT) ? "›" : "‹")
        : (collapsed(RIGHT) ? "‹" : "›")}
    </button>
  );

  const aside = (side: Side) => (
    <aside
      class="flex min-h-0 shrink-0 flex-col overflow-hidden bg-slate-100/70 dark:bg-slate-900/60"
      style={{ width: collapsed(side) ? "0px" : `${width(side)}px` }}
      aria-hidden={collapsed(side)}
    >
      <div class="h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        {side === LEFT ? props.left : props.right}
      </div>
    </aside>
  );

  const divider = (side: Side) => (
    <div class="relative flex w-2 shrink-0 items-stretch justify-center bg-slate-200/70 transition-colors hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={resizeLabel(side)}
        aria-valuemin={minWidth(side)}
        aria-valuemax={maxWidth(side)}
        aria-valuenow={width(side)}
        tabIndex={0}
        class={`h-full w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 ${collapsed(side) ? "pointer-events-none" : "cursor-col-resize"}`}
        onPointerDown={startDrag(side)}
        onPointerMove={moveDrag(side)}
        onPointerUp={endDrag(side)}
        onPointerCancel={endDrag(side)}
        onKeyDown={handleKeyDown(side)}
      />
    </div>
  );

  return (
    <div
      class={`flex w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${props.class ?? ""}`}
      style={{ height: height(), "min-height": `${props.minHeight ?? 480}px` }}
    >
      {aside(LEFT)}
      {divider(LEFT)}
      <section class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header class="flex h-11 shrink-0 items-center gap-1 border-b border-slate-200 bg-white/80 px-1.5 dark:border-white/10 dark:bg-slate-900/70">
          {toggleButton(LEFT)}
          <div class="min-w-0 flex-1 px-2">{props.toolbar}</div>
          {toggleButton(RIGHT)}
        </header>
        <div class="min-h-0 flex-1 overflow-auto">{props.children}</div>
      </section>
      {divider(RIGHT)}
      {aside(RIGHT)}
    </div>
  );
};
