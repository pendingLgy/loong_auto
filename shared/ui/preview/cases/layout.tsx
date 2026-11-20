import { Show, createSignal } from "solid-js";

import { translate, type Locale } from "../../src/i18n";
import { DEFAULT_LAYOUT_STATE, ThreePaneLayout, type LayoutState } from "../../src/layout";
import type { PreviewCase } from "../types";

function LayoutCase(props: { locale?: Locale; initial?: LayoutState }) {
  const [saved, setSaved] = createSignal<LayoutState | null>(null);
  const locale = () => props.locale ?? "zh-CN";
  const state = () => saved() ?? props.initial ?? DEFAULT_LAYOUT_STATE;

  return (
    <div class="grid gap-3">
      <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
        <ThreePaneLayout
          locale={locale()}
          value={state()}
          onChange={(next) => setSaved(next)}
          left={
            <div class="grid gap-1 p-3">
              <p class="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">Navigation</p>
              <p class="m-0 text-sm">会话列表</p>
              <p class="m-0 text-sm text-slate-500">用导航栏左侧按钮折叠</p>
            </div>
          }
          right={
            <div class="grid gap-1 p-3">
              <p class="m-0 text-xs font-semibold uppercase tracking-wider text-slate-500">Details</p>
              <p class="m-0 text-sm">工具状态</p>
              <p class="m-0 text-sm text-slate-500">用导航栏右侧按钮折叠</p>
            </div>
          }
        >
          <div class="grid gap-2 p-6">
            <h2 class="m-0 text-lg font-semibold">中栏内容</h2>
            <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
              拖动中间分隔条调整左右宽度；点击中栏顶部的折叠 / 展开按钮切换对应侧栏；
              松开拖动或切换折叠后会触发 onChange。
            </p>
          </div>
        </ThreePaneLayout>
      </div>

      <Show when={saved()}>
        <output class="text-xs text-slate-500 dark:text-slate-400">
          {translate(locale(), "layout.saved", "已保存布局：{{ state }}", {
            state: JSON.stringify(saved()),
          })}
        </output>
      </Show>
    </div>
  );
}

export const layoutCases: PreviewCase[] = [
  {
    id: "layout-default",
    group: "ThreePaneLayout",
    title: "默认布局",
    render: () => <LayoutCase />,
  },
  {
    id: "layout-restored",
    group: "ThreePaneLayout",
    title: "恢复上次宽度",
    render: () => (
      <LayoutCase
        initial={{ leftWidth: 320, rightWidth: 360, leftCollapsed: false, rightCollapsed: false }}
      />
    ),
  },
  {
    id: "layout-collapsed",
    group: "ThreePaneLayout",
    title: "两侧已折叠",
    render: () => (
      <LayoutCase
        initial={{ leftWidth: 240, rightWidth: 280, leftCollapsed: true, rightCollapsed: true }}
      />
    ),
  },
  {
    id: "layout-en",
    group: "ThreePaneLayout",
    title: "英文（locale=en-US）",
    render: () => <LayoutCase locale="en-US" />,
  },
];
