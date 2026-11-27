import {createSignal, onCleanup} from "solid-js";

import {CheckIcon, CopyIcon} from "../assets/icons";
import {useUiI18n} from "../i18n";
import {copyText} from "./copy";
import {dateTimeValue, formatMessageTime} from "./time";

export interface ChatUserMessageProps {
  content: string;
  createdAt: Date | string | number;
  onCopy?: () => void;
}

/** 用户消息：内容气泡、时间与复制操作，整体右对齐。 */
export function ChatUserMessage(props: ChatUserMessageProps) {
  const {t} = useUiI18n();
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  const copy = async () => {
    if (!await copyText(props.content)) return;
    setCopied(true);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 1500);
    props.onCopy?.();
  };

  return (
    <div class="flex w-full justify-end">
      <div class="flex max-w-[80%] min-w-0 flex-col items-end gap-1">
        <div class="whitespace-pre-wrap break-words rounded-xl bg-slate-100 px-3 py-2 text-[13px] leading-6 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {props.content}
        </div>
        <div class="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <time datetime={dateTimeValue(props.createdAt)}>
            {formatMessageTime(props.createdAt)}
          </time>
          <button
            type="button"
            onClick={copy}
            aria-label={copied() ? t("chat.copied", "已复制") : t("chat.copyMessage", "复制消息")}
            title={copied() ? t("chat.copied", "已复制") : t("chat.copyMessage", "复制消息")}
            class="grid h-6 w-6 place-items-center rounded text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            {copied()
              ? <CheckIcon class="h-3.5 w-3.5 text-emerald-500" />
              : <CopyIcon class="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
