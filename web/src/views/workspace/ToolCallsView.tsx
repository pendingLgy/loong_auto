import { For, Show, createSignal } from "solid-js";

import type { StoredToolCall } from "../../storage/chat_messages";

export interface ToolCallsViewProps {
  calls: StoredToolCall[];
  /** tool_calling 消息中已执行完成的工具结果。 */
  toolCallMessages?: unknown[];
  /** 执行尚未完成的工具调用。 */
  onRunTool?: (toolId: string) => void | Promise<boolean>;
  /** 开发环境显示手动发送按钮。 */
  devMode?: boolean;
  /** 开发环境下手动提交当前工具调用消息。 */
  onDevSend?: () => void | Promise<void>;
}

function toolLabel(call: StoredToolCall): string {
  const description = call.arguments.description;
  return typeof description === "string" && description.trim()
    ? description.trim()
    : call.name;
}

function toolArguments(call: StoredToolCall): Record<string, unknown> {
  const {description: _description, ...rest} = call.arguments;
  return rest;
}

/** 聊天中的工具调用折叠面板。 */
export function ToolCallsView(props: ToolCallsViewProps) {
  const [expanded, setExpanded] = createSignal(false);
  const [runningId, setRunningId] = createSignal("");

  const hasResult = (toolId: string) => (props.toolCallMessages ?? []).some((item) => {
    if (typeof item !== "object" || item === null) return false;
    const result = item as Record<string, unknown>;
    return result.tool_call_id === toolId
      && !(typeof result.content === "string"
        && result.content.includes("Run tool failed"));
  });

  const allDone = () => props.calls.length > 0
    && props.calls.every((call) => hasResult(call.id));

  const runTool = async (toolId: string) => {
    if (hasResult(toolId) || runningId()) return;
    setRunningId(toolId);
    try {
      await props.onRunTool?.(toolId);
    } finally {
      setRunningId("");
    }
  };

  return (
    <Show when={props.calls.length > 0}>
      <div class="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/5">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded()}
          class="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left outline-none transition hover:bg-amber-100/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/40 dark:hover:bg-amber-500/10"
        >
          <span class="shrink-0 text-[12px] font-semibold text-amber-700 dark:text-amber-300">
            工具调用
          </span>
          <span class="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            {allDone() ? "已完成" : props.calls.length}
          </span>
          <Show when={props.devMode && props.onDevSend}>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void props.onDevSend?.();
              }}
              class="shrink-0 rounded-md border border-sky-300 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-sky-700 outline-none transition hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-sky-500/30 dark:bg-slate-900/60 dark:text-sky-300 dark:hover:bg-sky-500/10"
            >
              发送
            </button>
          </Show>
          <span class="shrink-0 text-[10px] text-amber-600 dark:text-amber-400" aria-hidden="true">
            {expanded() ? "▴" : "▾"}
          </span>
        </button>

        <Show when={expanded()}>
          <ul class="m-0 grid list-none gap-1.5 border-t border-amber-200/70 px-2.5 py-2 dark:border-amber-500/15">
            <For each={props.calls}>
              {(call, index) => (
                <li class="min-w-0">
                  <details class="group min-w-0 rounded-lg bg-white/70 px-2.5 py-2 dark:bg-slate-900/40">
                    <summary class="flex min-w-0 cursor-pointer list-none items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 [&::-webkit-details-marker]:hidden">
                      <span class="text-[11px] tabular-nums text-amber-600 dark:text-amber-400">
                        {index() + 1}.
                      </span>
                      <span class="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
                        {toolLabel(call)}
                      </span>
                      <Show when={!hasResult(call.id)}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void runTool(call.id);
                          }}
                          disabled={runningId() === call.id}
                          class="shrink-0 rounded-md border border-amber-300 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-amber-700 outline-none transition hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:cursor-progress disabled:opacity-60 dark:border-amber-500/30 dark:bg-slate-900/60 dark:text-amber-300 dark:hover:bg-amber-500/10"
                        >
                          {runningId() === call.id ? "运行中" : "运行"}
                        </button>
                      </Show>
                      <Show when={call.location}>
                        <span class="shrink-0 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {call.location}
                        </span>
                      </Show>
                      <span class="shrink-0 text-[10px] text-slate-400 transition group-open:rotate-180 dark:text-slate-500" aria-hidden="true">
                        ▾
                      </span>
                    </summary>
                    <pre class="m-0 mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100/80 px-2 py-1 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                      {JSON.stringify(toolArguments(call), null, 2)}
                    </pre>
                  </details>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </Show>
  );
}
