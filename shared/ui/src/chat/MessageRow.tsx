import { Show, createSignal, onCleanup, type Component, type JSX } from "solid-js";

import { translate, type Locale } from "../i18n";
import { MarkdownContent } from "./MarkdownContent";
import { copyText } from "./clipboard";
import type { ChatMessage } from "./types";

function CopyIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg
      class="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 当天显示 HH:mm，今天之前显示 YYYY-MM-dd HH:mm。 */
function formatMessageTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const isToday = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (isToday) return `${hours}:${minutes}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hours}:${minutes}`;
}

export interface MessageRowProps {
  message: ChatMessage;
  locale: Locale;
  /** Markdown 渲染完成后的回调（传入根元素）。 */
  onRendered?: (element: HTMLElement) => void;
}

/** 单条聊天消息：用户消息右侧气泡，助手消息全宽展示，底部带复制与时间操作行。 */
export const MessageRow: Component<MessageRowProps> = (props) => {
  const [copied, setCopied] = createSignal(false);
  let copyTimer: number | undefined;

  const isUser = () => props.message.role === "user";
  const isSystem = () => props.message.role === "system";
  const timeLabel = () => formatMessageTime(props.message.createdAt);

  onCleanup(() => {
    if (copyTimer !== undefined) window.clearTimeout(copyTimer);
  });

  const copyMessage = () => {
    void copyText(props.message.content).then(() => {
      setCopied(true);
      if (copyTimer !== undefined) window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => setCopied(false), 1200);
    });
  };

  const copyButton = () => (
    <button
      type="button"
      onClick={copyMessage}
      aria-label={copied()
        ? translate(props.locale, "chat.copied", "已复制")
        : translate(props.locale, "chat.copyMessage", "复制")}
      title={copied()
        ? translate(props.locale, "chat.copied", "已复制")
        : translate(props.locale, "chat.copyMessage", "复制")}
      class="grid h-6 w-6 place-items-center rounded text-slate-400 outline-none transition hover:bg-slate-900/5 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300"
    >
      <Show when={copied()} fallback={<CopyIcon />}>
        <CheckIcon />
      </Show>
    </button>
  );

  const timeText = () => (
    <Show when={timeLabel()}>
      <span class="text-[11px] text-slate-400 dark:text-slate-500">{timeLabel()}</span>
    </Show>
  );

  return (
    <Show
      when={!isSystem()}
      fallback={
        <p class="m-0 px-2 text-center text-[12px] text-slate-400 dark:text-slate-500">
          {props.message.content}
        </p>
      }
    >
      <Show
        when={isUser()}
        fallback={
          <div class="grid w-full min-w-0 gap-1.5">
            <MarkdownContent
              content={props.message.content}
              locale={props.locale}
              onRendered={props.onRendered}
            />
            <div class="flex items-center gap-2">
              {copyButton()}
              {timeText()}
            </div>
          </div>
        }
      >
        <div class="flex flex-col items-end gap-1.5">
          <div class="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            {props.message.content}
          </div>
          <div class="flex items-center gap-2">
            {timeText()}
            {copyButton()}
          </div>
        </div>
      </Show>
    </Show>
  );
};
