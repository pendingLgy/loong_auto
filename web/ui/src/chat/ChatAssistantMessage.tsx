import {For, Show, createSignal, onCleanup} from "solid-js";
import type {JSX} from "@solidjs/web";

import {CheckIcon, ChevronRightIcon, CopyIcon} from "../assets/icons";
import {useUiI18n} from "../i18n";
import {ChatMarkdown} from "./ChatMarkdown";
import {copyText} from "./copy";
import {dateTimeValue, formatMessageTime} from "./time";

export type ChatApprovalStatus = "approved" | "rejected";

export interface ChatApprovalFile {
  id: string;
  name: string;
  status?: ChatApprovalStatus;
}

export interface ChatTool {
  id: string;
  name: string;
  content: string;
}

export interface ChatAssistantMessageProps {
  content: string;
  createdAt: Date | string | number;
  /** 当前执行的工具名称。 */
  currentTool?: string;
  tools?: ChatTool[];
  /** 工具执行详情最大高度类，默认 max-h-[50vh]。 */
  toolContentMaxHeightClass?: string;
  /** 需要审核的文件操作授权列表。 */
  approvalFiles?: ChatApprovalFile[];
  /** 审核行中已处理文件，默认折叠。 */
  processedApprovalFiles?: ChatApprovalFile[];
  /** 待审核列表最大高度类，默认 max-h-40。 */
  approvalMaxHeightClass?: string;
  /** 已处理列表最大高度类，默认 max-h-32。 */
  processedMaxHeightClass?: string;
  onApproveFile?: (file: ChatApprovalFile) => void;
  onRejectFile?: (file: ChatApprovalFile) => void;
  onCopy?: () => void;
}

function SummaryArrow(props: {class: string}) {
  return (
    <ChevronRightIcon
      class={`shrink-0 opacity-60 transition-transform ${props.class}`}
    />
  );
}

function ToolItem(props: {tool: ChatTool; maxHeightClass: string}) {
  const {t} = useUiI18n();
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  const copy = async () => {
    if (!await copyText(props.tool.content)) return;
    setCopied(true);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <details class="group/tool-item">
      <summary class="flex cursor-pointer list-none select-none items-center gap-2 px-2 py-1.5 text-[12px] text-slate-600 outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
        <span class="min-w-0 truncate">{props.tool.name}</span>
        <SummaryArrow class="h-4 w-4 group-open/tool-item:rotate-90" />
      </summary>
      <div class="relative">
        <button
          type="button"
          onClick={copy}
          aria-label={copied() ? t("chat.copied", "已复制") : t("chat.copyToolContent", "复制工具内容")}
          title={copied() ? t("chat.copied", "已复制") : t("chat.copyToolContent", "复制工具内容")}
          class="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded bg-white/90 text-slate-400 outline-none transition hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:bg-slate-900/90 dark:text-slate-500 dark:hover:text-slate-300"
        >
          {copied()
            ? <CheckIcon class="h-3.5 w-3.5 text-emerald-500" />
            : <CopyIcon class="h-3.5 w-3.5" />}
        </button>
        <div class={`mt-1 overflow-auto rounded-md bg-slate-100 p-2 pr-9 text-[11px] leading-5 text-slate-700 dark:bg-slate-800 dark:text-slate-200 ${props.maxHeightClass}`}>
          <pre class="m-0 whitespace-pre-wrap break-words font-mono">{props.tool.content}</pre>
        </div>
      </div>
    </details>
  );
}

/** 助手消息：工具执行内容、Markdown 内容与复制操作，整体左对齐。 */
export function ChatAssistantMessage(props: ChatAssistantMessageProps) {
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
    <div class="flex w-full justify-start">
      <div class="flex w-full min-w-0 flex-col items-start gap-2">
        {(props.currentTool || props.tools?.length) && (
          <details class="group/tool-block w-full min-w-0 open:border-b open:border-slate-200 dark:open:border-slate-700">
            <summary class="flex cursor-pointer list-none select-none items-center gap-2 px-1 py-1.5 text-[12px] text-slate-500 outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden="true" />
              <span>{t("chat.currentTool", "当前执行工具")}</span>
              <span class="min-w-0 truncate font-medium text-slate-600 dark:text-slate-300">
                {props.currentTool ?? props.tools?.[0]?.name}
              </span>
              <SummaryArrow class="h-4 w-4 group-open/tool-block:rotate-90" />
            </summary>
            <Show when={props.tools?.length}>
              <div class="max-h-[70vh] overflow-y-auto p-2">
                <For each={props.tools}>
                  {(tool) => (
                    <ToolItem
                      tool={tool}
                      maxHeightClass={props.toolContentMaxHeightClass ?? "max-h-[50vh]"}
                    />
                  )}
                </For>
              </div>
            </Show>
          </details>
        )}

        {props.approvalFiles?.length ? (
          <details class="group/approval w-full min-w-0">
            <summary class="inline-flex cursor-pointer list-none select-none items-center gap-1 px-1 py-1.5 text-[11px] font-medium text-amber-600 outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-amber-400 [&::-webkit-details-marker]:hidden">
              <span>{t("chat.fileApproval", "需要审核的文件操作授权")}</span>
              <SummaryArrow class="h-4 w-4 group-open/approval:rotate-90" />
            </summary>
            <div class={`mt-1 grid overflow-y-auto pr-1 ${props.approvalMaxHeightClass ?? "max-h-40"}`}>
              <For each={props.approvalFiles}>
                {(file) => (
                  <div class="flex items-center justify-between gap-3 rounded border-t border-amber-200/70 px-1 py-1.5 transition hover:bg-amber-50/70 first:border-t-0 dark:border-amber-800/50 dark:hover:bg-amber-500/5">
                    <span class="min-w-0 truncate text-[12px] text-slate-600 dark:text-slate-300">
                      {file.name}
                    </span>
                    <div class="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => props.onRejectFile?.(file)}
                        class="inline-flex h-7 items-center rounded-md border border-red-300 px-2 text-[11px] text-red-600 outline-none transition hover:border-red-400 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:border-red-700/70 dark:text-red-400 dark:hover:border-red-600 dark:hover:text-red-300"
                      >
                        {t("chat.reject", "拒绝")}
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onApproveFile?.(file)}
                        class="inline-flex h-7 items-center rounded-md border border-emerald-300 px-2 text-[11px] font-medium text-emerald-600 outline-none transition hover:border-emerald-400 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-emerald-700/70 dark:text-emerald-400 dark:hover:border-emerald-600 dark:hover:text-emerald-300"
                      >
                        {t("chat.approve", "同意")}
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {props.processedApprovalFiles?.length ? (
              <details class="group/processed mt-2 border-t border-amber-200/70 pt-2 dark:border-amber-800/50">
                <summary class="inline-flex cursor-pointer list-none select-none items-center gap-1 text-[11px] text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
                  <span>{t("chat.processedFiles", "已处理文件")}</span>
                  <span class="text-slate-400 dark:text-slate-500">
                    ({props.processedApprovalFiles.length})
                  </span>
                  <SummaryArrow class="h-4 w-4 group-open/processed:rotate-90" />
                </summary>
                <div class={`mt-1.5 grid gap-1 overflow-y-auto pr-1 ${props.processedMaxHeightClass ?? "max-h-32"}`}>
                  <For each={props.processedApprovalFiles}>
                    {(file) => (
                      <div class="flex items-center justify-between gap-2 rounded px-1 py-0.5 transition hover:bg-slate-100/70 dark:hover:bg-slate-800/60">
                        <span class="min-w-0 truncate text-[11px] text-slate-400 dark:text-slate-500">
                          {file.name}
                        </span>
                        <Show when={file.status}>
                          <span
                            class={`shrink-0 rounded px-1.5 text-[10px] ${
                              file.status === "rejected"
                                ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                            }`}
                          >
                            {file.status === "rejected"
                              ? t("chat.reject", "拒绝")
                              : t("chat.approve", "同意")}
                          </span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </details>
            ) : null}
          </details>
        ) : null}

        <div class="w-full min-w-0">
          <ChatMarkdown content={props.content} />
        </div>

        <div class="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
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
          <time datetime={dateTimeValue(props.createdAt)}>
            {formatMessageTime(props.createdAt)}
          </time>
        </div>
      </div>
    </div>
  );
}
