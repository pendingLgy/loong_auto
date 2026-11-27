import { ChatAssistantMessage, ChatMessageList, ChatUserMessage } from "../../../src";

/** ChatMessageList 独立预览。 */
export function ChatMessageListPreview() {
  return (
    <div class="grid gap-5">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          ChatMessageList
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          消息列表、空状态与用户消息组合。
        </p>
      </div>

      <div class="grid gap-2">
        <h3 class="m-0 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          空状态
        </h3>
        <div class="h-56 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <ChatMessageList />
        </div>
      </div>

      <div class="grid gap-2">
        <h3 class="m-0 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          消息列表
        </h3>
        <div class="h-64 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <ChatMessageList>
            <ChatUserMessage
              content="帮我整理一下今天的会议纪要。"
              createdAt={new Date()}
            />
            <ChatUserMessage
              content="按主题分组，最后列出待办事项。"
              createdAt={new Date()}
            />
            <ChatAssistantMessage
              content={"已整理完成：\n\n- 产品进度\n- 风险\n- 待办"}
              createdAt={new Date()}
            />
          </ChatMessageList>
        </div>
      </div>
    </div>
  );
}
