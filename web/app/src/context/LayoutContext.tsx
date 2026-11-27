import {type Accessor, createSignal,} from "solid-js";
import {createEventListener} from "@solid-primitives/event-listener";

import {type LayoutSettings, readLayout, saveLayout,} from "../store/layout";
import {createSimpleContext} from "./ContextHelper";

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


function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

const layoutCtx = createSimpleContext<LayoutContextValue>({
  name: "",
  gate: false,
  init: () => {
    const [layout, setLayout] = createSignal<LayoutSettings>(readLayout());
    const update = (next: LayoutSettings) => {
      setLayout(next);
      saveLayout(next);
    };
    const setLeftWidth = (width: number) => update({...layout(), left_width: width});
    const setRightWidth = (width: number) => update({...layout(), right_width: width});
    const setLeftOpen = (open: boolean) => update({...layout(), left_open: open});
    const setRightOpen = (open: boolean) => update({...layout(), right_open: open});


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
        startWidth: side === "left" ? layout().left_width : layout().right_width,
      });
    };

    createEventListener(window, "pointermove", (event) => {
      const current = drag();
      if (!current) return;

      const delta = event.clientX - current.startX;
      if (current.side === "left") {
        const max = window.innerWidth - MIN_CENTER_WIDTH
          - (layout().right_open ? layout().right_width : 0) - 40;
        setLeftWidth(clamp(current.startWidth + delta, MIN_LEFT_WIDTH, max));
      } else {
        const max = window.innerWidth - MIN_CENTER_WIDTH - layout().left_width - 40;
        setRightWidth(clamp(current.startWidth - delta, MIN_RIGHT_WIDTH, max));
      }
    });

    createEventListener(window, "pointerup", () => setDrag(null));

    return {
      layout,
      setLeftWidth,
      setRightWidth,
      setLeftOpen,
      setRightOpen,
      startResize,
    }
  }
})

export const useLayoutContext = layoutCtx.use
export const LayoutProvider = layoutCtx.provider
