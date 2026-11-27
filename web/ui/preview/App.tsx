import { Show, createEffect, createSignal } from "solid-js";

import { MenuPreview } from "./components/menu/MenuPreview";
import { PreviewNav } from "./components/nav/PreviewNav";
import { ThemePreview } from "./components/theme/ThemePreview";
import { WorkspaceDoc } from "./components/workspace/WorkspaceDoc";
import { WorkspaceErrorPreview } from "./components/workspace/WorkspaceErrorPreview";
import { WorkspacePreview } from "./components/workspace/WorkspacePreview";
import type { MenuCategory, PreviewKey, WorkspaceView } from "./types";

const STORAGE_KEY = "loong.ui.preview.selection";

interface PreviewSelection {
  active: PreviewKey;
  category: MenuCategory;
  workspaceView: WorkspaceView;
}

function readSelection(): PreviewSelection | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as PreviewSelection : null;
  } catch {
    return null;
  }
}

export function App() {
  const [dark, setDark] = createSignal(
    document.documentElement.classList.contains("dark"),
  );
  const saved = readSelection();
  const active = saved?.active && ["menu", "workspace", "theme"].includes(saved.active)
    ? saved.active : "menu";
  const category = saved?.category
    && ["basic", "default", "states", "custom", "nested", "props"].includes(saved.category)
    ? saved.category : "basic";
  const workspaceView = saved?.workspaceView
    && ["preview", "doc", "error"].includes(saved.workspaceView)
    ? saved.workspaceView : "preview";
  const [activeState, setActive] = createSignal<PreviewKey>(active);
  const [categoryState, setCategory] = createSignal<MenuCategory>(category);
  const [workspaceViewState, setWorkspaceView] = createSignal<WorkspaceView>(workspaceView);

  createEffect(
    () => ({
      active: activeState(),
      category: categoryState(),
      workspaceView: workspaceViewState(),
    }),
    (selection) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    },
  );

  const toggleTheme = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <main class="grid h-dvh w-full grid-rows-[auto_1fr] gap-6 overflow-hidden px-6 py-6">
      <header class="flex items-center justify-between gap-4">
        <div class="grid gap-1">
          <p class="m-0 text-[12px] font-medium uppercase tracking-[0.2em] text-indigo-500">
            @loong/ui
          </p>
          <h1 class="m-0 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Component Preview
          </h1>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          class="inline-flex h-9 items-center justify-center rounded-md bg-indigo-500 px-4 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          {dark() ? "切换浅色" : "切换深色"}
        </button>
      </header>

      <div class="grid min-h-0 gap-5 lg:grid-cols-[220px_1fr]">
        <PreviewNav
          active={activeState()}
          category={categoryState()}
          onActiveChange={setActive}
          onCategoryChange={setCategory}
          workspaceView={workspaceViewState()}
          onWorkspaceViewChange={setWorkspaceView}
        />

        <section class="min-h-0 min-w-0 overflow-auto rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <Show when={activeState() === "menu"}>
            <MenuPreview category={categoryState()} />
          </Show>
          <Show when={activeState() === "workspace"}>
            <Show when={workspaceViewState() === "preview"}>
              <WorkspacePreview />
            </Show>
            <Show when={workspaceViewState() === "doc"}>
              <WorkspaceDoc />
            </Show>
            <Show when={workspaceViewState() === "error"}>
              <WorkspaceErrorPreview />
            </Show>
          </Show>
          <Show when={activeState() === "theme"}>
            <ThemePreview />
          </Show>
        </section>
      </div>
    </main>
  );
}
