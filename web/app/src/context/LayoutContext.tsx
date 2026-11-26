import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js";
import { createEventListener } from "@solid-primitives/event-listener";

import {
  readLayout,
  saveLayout,
  type LayoutSettings,
} from "../store/layout";

const MIN_LEFT_WIDTH = 200;
const MIN_CENTER_WIDTH = 480;
const MIN_RIGHT_WIDTH = 240;

export type ResizeSide = "left" | "right";

interface LayoutContextValue {
  layout: Accessor<LayoutSettings>;
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  startResize: (side: ResizeSide, event: PointerEvent) => void;
}

const LayoutContext = createContext<LayoutContextValue>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** 布局上下文；宽度、折叠状态与拖动事件统一在这里管理。 */
export function LayoutProvider(props: ParentProps) {
  const [layout, setLayout] = createSignal<LayoutSettings>(readLayout());
  const update = (next: LayoutSettings) => {
    setLayout(next);
    saveLayout(next);
  };
  const setLeftWidth = (width: number) => update({...layout(), leftWidth: width});
  const setRightWidth = (width: number) => update({...layout(), rightWidth: width});
  const setLeftOpen = (open: boolean) => update({...layout(), leftOpen: open});
  const setRightOpen = (open: boolean) => update({...layout(), rightOpen: open});

  const [drag, setDrag] = createSignal<{
    side: ResizeSide;
    startX: number;
    startWidth: number;
  } | null>(null);

  const startResize = (side: ResizeSide, event: PointerEvent) => {
    event.preventDefault();
    setDrag({
      side,
      startX: event.clientX,
      startWidth: side === "left" ? layout().leftWidth : layout().rightWidth,
    });
  };

  createEventListener(window, "pointermove", (event) => {
    const current = drag();
    if (!current) return;

    const delta = event.clientX - current.startX;
    if (current.side === "left") {
      const max = window.innerWidth - MIN_CENTER_WIDTH
        - (layout().rightOpen ? layout().rightWidth : 0) - 40;
      setLeftWidth(clamp(current.startWidth + delta, MIN_LEFT_WIDTH, max));
    } else {
      const max = window.innerWidth - MIN_CENTER_WIDTH - layout().leftWidth - 40;
      setRightWidth(clamp(current.startWidth - delta, MIN_RIGHT_WIDTH, max));
    }
  });

  createEventListener(window, "pointerup", () => setDrag(null));

  return (
    <LayoutContext
      value={{
        layout,
        setLeftWidth,
        setRightWidth,
        setLeftOpen,
        setRightOpen,
        startResize,
      }}
    >
      {props.children}
    </LayoutContext>
  );
}

/** 读取布局上下文，必须在 LayoutProvider 内使用。 */
export function useLayoutContext(): LayoutContextValue {
  return useContext(LayoutContext);
}
