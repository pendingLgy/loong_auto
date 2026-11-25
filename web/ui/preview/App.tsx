import { createSignal } from "solid-js";

import { Button } from "../src";

export function App() {
  const [dark, setDark] = createSignal(
    document.documentElement.classList.contains("dark"),
  );
  const [count, setCount] = createSignal(0);

  const toggleTheme = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <main class="mx-auto grid min-h-dvh w-full max-w-4xl gap-6 px-6 py-10">
      <header class="flex items-center justify-between gap-4">
        <div class="grid gap-1">
          <p class="m-0 text-[12px] font-medium uppercase tracking-[0.2em] text-indigo-500">
            @loong/ui
          </p>
          <h1 class="m-0 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Component Preview
          </h1>
        </div>
        <Button onClick={toggleTheme}>
          {dark() ? "切换浅色" : "切换深色"}
        </Button>
      </header>

      <section class="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          Button
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          基础按钮样式与主题 token 预览。
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <Button onClick={() => setCount((value) => value + 1)}>
            点击次数 {count()}
          </Button>
          <Button disabled>禁用状态</Button>
        </div>
      </section>

      <section class="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          Theme Tokens
        </h2>
        <div class="grid grid-cols-2 gap-2 text-[12px] text-slate-500 sm:grid-cols-4 dark:text-slate-400">
          <div class="rounded-md bg-indigo-500 p-3 text-white">Primary</div>
          <div class="rounded-md bg-emerald-600 p-3 text-white">Success</div>
          <div class="rounded-md bg-amber-600 p-3 text-white">Warning</div>
          <div class="rounded-md bg-red-600 p-3 text-white">Error</div>
        </div>
      </section>
    </main>
  );
}
