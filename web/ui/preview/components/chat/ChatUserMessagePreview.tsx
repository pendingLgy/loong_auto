import {createSignal} from "solid-js";

import {ChatUserMessage} from "../../../src";

/** ChatUserMessage 独立预览。 */
export function ChatUserMessagePreview() {
  const [copied, setCopied] = createSignal(false);
  const today = new Date();
  const previousDay = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  return (
    <div class="grid gap-5">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          ChatUserMessage
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          用户消息内容、创建时间与复制操作。
        </p>
      </div>

      <div class="grid gap-5 rounded-xl border border-slate-200 p-5 dark:border-slate-700">
        <ChatUserMessage
          content={"帮我整理一下今天的会议纪要，按主题分组。\n最后列出待办事项。"}
          createdAt={today}
          onCopy={() => setCopied(true)}
        />
        <ChatUserMessage
          content="上一轮对话的历史消息，时间显示完整日期。"
          createdAt={previousDay}
          onCopy={() => setCopied(true)}
        />
      </div>

      <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
        复制状态：{copied() ? "已复制" : "暂无"}
      </p>
    </div>
  );
}
