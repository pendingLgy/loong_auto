/** 主题 token 预览。 */
export function ThemePreview() {
  return (
    <div class="grid gap-4">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          Theme Tokens
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          主题色与状态色预览。
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2 text-[12px] text-slate-500 sm:grid-cols-4 dark:text-slate-400">
        <div class="rounded-md bg-indigo-500 p-3 text-white">Primary</div>
        <div class="rounded-md bg-emerald-600 p-3 text-white">Success</div>
        <div class="rounded-md bg-amber-600 p-3 text-white">Warning</div>
        <div class="rounded-md bg-red-600 p-3 text-white">Error</div>
      </div>
    </div>
  );
}
