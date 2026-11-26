/** 设置项选中 / 未选中样式。 */
export function optionClass(selected: boolean): string {
  return `rounded-lg border px-3 py-2 text-[13px] outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
    selected
      ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
  }`;
}
