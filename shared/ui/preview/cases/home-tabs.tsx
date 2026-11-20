import { createSignal } from "solid-js";

import { HomeTabs, type HomeTab } from "../../src/home-tabs";
import type { PreviewCase } from "../types";

const TABS: HomeTab[] = [
  { key: "chat", label: "对话" },
  { key: "tools", label: "工具" },
  { key: "settings", label: "设置" },
];

const SORTED_TABS: HomeTab[] = [
  { key: "a", label: "标签 A", sort: 30 },
  { key: "b", label: "标签 B", sort: 10 },
  { key: "c", label: "标签 C", sort: 20 },
];

const MANY_TABS: HomeTab[] = Array.from({ length: 30 }, (_, index) => ({
  key: `tab-${index + 1}`,
  label: `标签 ${index + 1}`,
}));

function HomeTabsCase(props: { tabs?: HomeTab[] }) {
  const [active, setActive] = createSignal("chat");
  const [dark, setDark] = createSignal(false);
  const [lastAction, setLastAction] = createSignal("无");

  return (
    <div class="grid gap-3 p-4">
      <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
        <HomeTabs
          tabs={props.tabs ?? TABS}
          active={active()}
          onSelect={(key) => {
            setActive(key);
            setLastAction(`切换：${key}`);
          }}
          onAdd={() => setLastAction("新建")}
          onPin={(key) => setLastAction(`固定：${key}`)}
          onUnpin={(key) => setLastAction(`取消固定：${key}`)}
          onPinnedChange={(keys) => setLastAction(`固定列表：${keys.join(", ")}`)}
          onServerInfo={() => setLastAction("服务器信息")}
          dark={dark()}
          onToggleTheme={() => {
            setDark((value) => !value);
            setLastAction(dark() ? "切换到浅色" : "切换到深色");
          }}
        />
      </div>
      <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
        当前标签：{active()}，操作：{lastAction()}
      </p>
    </div>
  );
}

export const homeTabsCases: PreviewCase[] = [
  {
    id: "home-tabs-default",
    group: "HomeTabs",
    title: "已登录",
    render: () => <HomeTabsCase />,
  },
  {
    id: "home-tabs-sort",
    group: "HomeTabs",
    title: "按 sort 排序",
    render: () => <HomeTabsCase tabs={SORTED_TABS} />,
  },
  {
    id: "home-tabs-overflow",
    group: "HomeTabs",
    title: "30 个标签（横向滚动）",
    render: () => <HomeTabsCase tabs={MANY_TABS} />,
  },
];
