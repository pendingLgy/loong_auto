import { useHomeView } from "./home-context";

/** HomePage 中栏的默认内容（嵌套路由 `/`）。 */
export function HomeIndex() {
  const { active, activeConversationId } = useHomeView();

  return (
    <div class="grid gap-3 p-6">
      <h1 class="m-0 text-xl font-semibold">Home</h1>
      <p class="m-0 max-w-prose text-sm text-slate-500 dark:text-slate-400">
        当前分区：{active() === "newChat" ? "新建对话" : "自动化任务"}
        ，当前对话：{activeConversationId()}。左右栏可拖动或折叠，布局状态会保存到本地设置，
        下次打开自动恢复。
      </p>
    </div>
  );
}
