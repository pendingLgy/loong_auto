import {Show} from "solid-js";
import type {JSX} from "@solidjs/web";

import { useUiI18n } from "../i18n";

export interface ChatMessageListProps {
  emptyTitle?: string;
  emptyDescription?: string;
  children?: JSX.Element;
}

/** 聊天消息列表；当前为空状态。 */
export function ChatMessageList(props: ChatMessageListProps) {
  const {t} = useUiI18n();
  return (
    <Show
      when={props.children}
      fallback={(
        <div class="grid min-h-0 flex-1 place-items-center overflow-auto p-6">
          <div class="grid max-w-md gap-2 text-center">
            <p class="m-0 text-base font-medium text-slate-600 dark:text-slate-300">
              {props.emptyTitle ?? t("chat.emptyTitle", "开始新的对话")}
            </p>
            <p class="m-0 text-[13px] text-slate-400 dark:text-slate-500">
              {props.emptyDescription ?? t("chat.emptyDescription", "在下方输入提示词，开始与模型对话。")}
            </p>
          </div>
        </div>
      )}
    >
      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
        {props.children}
      </div>
    </Show>
  );
}
