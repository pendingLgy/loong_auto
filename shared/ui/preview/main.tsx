import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import { render } from "solid-js/web";

import "./styles.css";
import { cases } from "./cases";
import type { PreviewCase } from "./types";

type Theme = "light" | "dark";

const THEME_KEY = "loong-ui-preview-theme";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function caseFromHash(): PreviewCase {
  const id = typeof location === "undefined" ? "" : decodeURIComponent(location.hash.replace(/^#/, ""));
  return cases.find((item) => item.id === id) ?? cases[0];
}

function groupCases(items: PreviewCase[]): { group: string; cases: PreviewCase[] }[] {
  const groups: { group: string; cases: PreviewCase[] }[] = [];
  for (const item of items) {
    const existing = groups.find((entry) => entry.group === item.group);
    if (existing) {
      existing.cases.push(item);
    } else {
      groups.push({ group: item.group, cases: [item] });
    }
  }
  return groups;
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("缺少 #root 挂载点");
}

const [theme, setTheme] = createSignal<Theme>(initialTheme());
document.documentElement.classList.toggle("dark", theme() === "dark");
document.documentElement.style.colorScheme = theme();

createEffect(() => {
  const value = theme();
  document.documentElement.classList.toggle("dark", value === "dark");
  document.documentElement.style.colorScheme = value;
  window.localStorage.setItem(THEME_KEY, value);
});

const [query, setQuery] = createSignal("");
const [expanded, setExpanded] = createSignal<ReadonlySet<string>>(new Set<string>());
const [active, setActive] = createSignal<PreviewCase>(caseFromHash());

const searching = createMemo(() => query().trim().length > 0);

const filteredCases = createMemo(() => {
  const keyword = query().trim().toLowerCase();
  if (!keyword) return cases;
  return cases.filter((item) =>
    [item.id, item.group, item.title].some((value) => value.toLowerCase().includes(keyword)));
});

const groups = createMemo(() => groupCases(filteredCases()));

function isExpanded(group: string): boolean {
  // 搜索时强制展开命中的分组，避免用户还要再点一次。
  return searching() || expanded().has(group);
}

function toggleGroup(group: string) {
  setExpanded((previous) => {
    const next = new Set(previous);
    if (next.has(group)) {
      next.delete(group);
    } else {
      next.add(group);
    }
    return next;
  });
}

function activate(item: PreviewCase) {
  setActive(item);
  setExpanded((previous) => {
    const next = new Set(previous);
    next.add(item.group);
    return next;
  });
  if (typeof location !== "undefined") {
    history.replaceState(null, "", `#${encodeURIComponent(item.id)}`);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => setActive(caseFromHash()));
}

function toggleTheme() {
  setTheme((value) => (value === "dark" ? "light" : "dark"));
}

render(() => (
  <div class="flex min-h-screen flex-col bg-slate-50 text-slate-800 md:flex-row dark:bg-slate-950 dark:text-slate-200">
    <main class="order-2 min-w-0 flex-1">
      <header class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 dark:border-white/10 dark:bg-slate-950/90">
        <span class="text-[13px] text-slate-600 dark:text-slate-300">{active().title}</span>
        <code class="text-[11px] text-slate-500">{active().id}</code>
      </header>
      <Show when={active()} keyed>
        {(item) => <div class="preview-stage">{item.render()}</div>}
      </Show>
    </main>

    <aside class="order-1 flex w-full shrink-0 flex-col border-b border-slate-200 bg-white/95 md:h-screen md:w-72 md:border-b-0 md:border-r dark:border-white/10 dark:bg-slate-950/95">
      <header class="shrink-0 px-4 pt-4">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h1 class="m-0 text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">组件预览</h1>
            <p class="m-0 mt-1 text-xs text-slate-500">修改 src / preview 文件会实时热更新</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme() === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            aria-pressed={theme() === "dark"}
            title={theme() === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            class="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-[12px] text-slate-600 transition hover:bg-slate-900/5 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
          >
            {theme() === "dark" ? "☀ 浅色" : "☾ 深色"}
          </button>
        </div>

        <input
          type="search"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder="搜索组件或用例"
          aria-label="搜索预览用例"
          class="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </header>

      <nav
        class="mt-2 max-h-[45vh] min-h-0 flex-1 overflow-y-auto px-2 pb-4 md:max-h-none"
        aria-label="预览用例"
      >
        <Show
          when={groups().length > 0}
          fallback={<p class="px-2 py-4 text-xs text-slate-500">没有匹配的用例</p>}
        >
          <For each={groups()}>
            {(entry) => (
              <section class="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.group)}
                  aria-expanded={isExpanded(entry.group)}
                  class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                >
                  <span class="inline-block w-3 text-center">{isExpanded(entry.group) ? "▾" : "▸"}</span>
                  <span class="flex-1">{entry.group}</span>
                  <span class="text-[10px] text-slate-400 dark:text-slate-600">{entry.cases.length}</span>
                </button>

                <Show when={isExpanded(entry.group)}>
                  <ul class="m-0 mt-1 list-none p-0">
                    <For each={entry.cases}>
                      {(item) => (
                        <li>
                          <a
                            href={`#${encodeURIComponent(item.id)}`}
                            onClick={(event) => {
                              event.preventDefault();
                              activate(item);
                            }}
                            aria-current={active().id === item.id ? "page" : undefined}
                            class={`block truncate rounded-lg px-2 py-1.5 pl-7 text-[13px] transition ${
                              active().id === item.id
                                ? "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                                : "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/5"
                            }`}
                          >
                            {item.title}
                          </a>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </section>
            )}
          </For>
        </Show>
      </nav>
    </aside>
  </div>
), root);
