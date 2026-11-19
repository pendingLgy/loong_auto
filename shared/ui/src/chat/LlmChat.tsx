import { For, Show, createEffect, createSignal, onCleanup, type Component, type JSX } from "solid-js";

import { createVirtualizer } from "@tanstack/solid-virtual";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import { MessageRow } from "./MessageRow";
import type { ChatMessage } from "./types";
import {
  ModelPicker,
  type ConnectValues,
  type ManagedProvider,
  type ModelGroup,
  type ProviderOption,
} from "../model-picker";

function SendIcon(): JSX.Element {
  return (
    <svg
      class="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function StopIcon(): JSX.Element {
  return (
    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function PlusIcon(): JSX.Element {
  return (
    <svg
      class="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export interface LlmChatProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 消息列表。 */
  messages?: ChatMessage[];
  /** 助手是否正在生成回复。 */
  streaming?: boolean;
  /** 禁用输入与发送。 */
  disabled?: boolean;
  /** 发送消息（纯文本，保留换行）。 */
  onSend?: (content: string) => void;
  /** 停止生成。 */
  onStop?: () => void;
  /** 当前使用的模型名称。 */
  modelName?: string;
  /** 当前模型所属供应商的别称。 */
  providerAlias?: string;
  /** 可选的模型，按供应商分组。 */
  modelGroups?: ModelGroup[];
  /** 选择某个模型。 */
  onSelectModel?: (model: string, group: ModelGroup) => void;
  /** 可添加的供应商列表。 */
  providers?: ProviderOption[];
  /** 已配置的供应商及其模型。 */
  managedProviders?: ManagedProvider[];
  /** 连接供应商。 */
  onConnectProvider?: (provider: ProviderOption, values: ConnectValues) => Promise<void>;
  /** 保存模型启用状态。 */
  onSaveModels?: (providers: ManagedProvider[]) => Promise<void>;
  /** 点击输入区下方「+」按钮。 */
  onAdd?: () => void;
  /** 最小宽度（px），默认 320。 */
  minWidth?: number;
  class?: string;
}

/**
 * LLM 聊天面板：消息列表 + contenteditable 输入区。
 *
 * 无消息时输入区居中显示；有消息后输入区浮动在消息列表底部。
 */
export const LlmChat: Component<LlmChatProps> = (props) => {
  const [hasContent, setHasContent] = createSignal(false);
  const [showModels, setShowModels] = createSignal(false);

  let scroller: HTMLDivElement | undefined;
  let input: HTMLDivElement | undefined;

  const locale = () => props.locale ?? DEFAULT_LOCALE;
  const messages = () => props.messages ?? [];
  const canSend = () => hasContent() && !props.disabled && !props.streaming;

  const virtualizer = createVirtualizer({
    get count() {
      return messages().length;
    },
    getScrollElement: () => scroller ?? null,
    estimateSize: () => 64,
    overscan: 8,
  });

  const modelInfo = () => {
    const provider = props.providerAlias?.trim() ?? "";
    const model = props.modelName?.trim() ?? "";
    if (provider && model) return `${provider} / ${model}`;
    return provider || model || translate(locale(), "chat.noModel", "未选择模型");
  };

  createEffect(() => {
    const count = messages().length;
    props.streaming;
    if (count > 0 && scroller) {
      virtualizer.scrollToIndex(count - 1, { align: "end" });
    }
  });

  // Markdown 是异步渲染的，渲染完成后高度会变化；这里针对具体行重新测量，
  // 避免虚拟列表仍按旧高度排布导致消息重叠。
  const pendingRows = new Set<HTMLElement>();
  let measureFrame: number | undefined;
  const measureRow = (element: HTMLElement) => {
    const row = element.closest<HTMLElement>("[data-index]");
    if (!row) return;
    pendingRows.add(row);
    if (measureFrame !== undefined) return;
    measureFrame = requestAnimationFrame(() => {
      measureFrame = undefined;
      pendingRows.forEach((node) => virtualizer.measureElement(node));
      pendingRows.clear();
    });
  };

  onCleanup(() => {
    if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
  });

  const syncContent = () => {
    if (!input) return;
    setHasContent((input.innerText || "").replace(/\u00a0/g, " ").trim().length > 0);
  };

  const clearInput = () => {
    if (!input) return;
    input.innerHTML = "";
    setHasContent(false);
  };

  const send = () => {
    if (!canSend() || !input) return;
    const content = input.innerText.replace(/\u00a0/g, " ").trim();
    if (!content) return;

    props.onSend?.(content);
    clearInput();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const composer = () => (
    <div class="pointer-events-auto grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 dark:border-white/10 dark:bg-slate-900">
      <div
        ref={input}
        contenteditable={!props.disabled}
        role="textbox"
        aria-multiline="true"
        aria-label={translate(locale(), "chat.placeholder", "发送消息…")}
        aria-disabled={props.disabled}
        data-placeholder={translate(locale(), "chat.placeholder", "发送消息…")}
        class="max-h-32 min-h-8 overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-2 py-1 text-sm text-slate-900 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 aria-disabled:opacity-60 dark:text-slate-100 dark:empty:before:text-slate-500"
        onInput={syncContent}
        onKeyDown={handleKeyDown}
      />

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => props.onAdd?.()}
          aria-label={translate(locale(), "chat.add", "添加")}
          title={translate(locale(), "chat.add", "添加")}
          class="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 outline-none transition hover:bg-slate-900/5 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
        >
          <PlusIcon />
        </button>

        <button
          type="button"
          onClick={() => setShowModels(true)}
          class="flex h-8 w-fit min-w-0 max-w-full items-center overflow-hidden rounded-md px-[10px] text-left text-sm text-slate-500 outline-none transition hover:bg-slate-900/5 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          <span class="truncate">{modelInfo()}</span>
        </button>

        <div class="ml-auto flex shrink-0 items-center gap-1.5">
          <Show when={props.streaming}>
            <button
              type="button"
              onClick={() => props.onStop?.()}
              aria-label={translate(locale(), "chat.stop", "停止")}
              title={translate(locale(), "chat.stop", "停止")}
              class="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-700 outline-none transition hover:bg-slate-900/5 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <StopIcon />
            </button>
          </Show>

          <Show when={!props.streaming}>
            <button
              type="button"
              onClick={send}
              disabled={!canSend()}
              aria-label={translate(locale(), "chat.send", "发送")}
              title={translate(locale(), "chat.send", "发送")}
              class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-linear-to-b from-sky-500 to-blue-600 text-white outline-none transition hover:from-sky-400 hover:to-blue-500 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendIcon />
            </button>
          </Show>
        </div>
      </div>
    </div>
  );

  return (
    <section
      aria-label={translate(locale(), "chat.label", "聊天")}
      class={`relative mx-auto flex h-full min-h-0 w-full max-w-[var(--chat-max-width)] flex-col bg-white dark:bg-slate-950 ${props.class ?? ""}`}
      style={{ "--chat-max-width": `max(80%, ${props.minWidth ?? 320}px)` }}
    >
      <div
        ref={scroller}
        class={`flex-1 overflow-y-auto p-4 ${messages().length > 0 ? "pb-44" : ""}`}
      >
        <Show
          when={messages().length > 0}
          fallback={
            <div class="flex h-full flex-col items-center justify-center gap-4">
              <p class="m-0 text-sm text-slate-400 dark:text-slate-500">
                {translate(locale(), "chat.empty", "开始新的对话")}
              </p>
              <div class="w-full">{composer()}</div>
            </div>
          }
        >
          <div class="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            <For each={virtualizer.getVirtualItems()}>
              {(item) => (
                <div
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  class="absolute left-0 top-0 w-full pb-[40px]"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <MessageRow
                    message={messages()[item.index]}
                    locale={locale()}
                    onRendered={measureRow}
                  />
                </div>
              )}
            </For>
          </div>

          <Show when={props.streaming}>
            <div class="flex items-center gap-2 px-1 pt-1 text-[12px] text-slate-500 dark:text-slate-400">
              <span class="flex gap-1" aria-hidden="true">
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
              </span>
              {translate(locale(), "chat.streaming", "正在生成…")}
            </div>
          </Show>
        </Show>
      </div>

      <Show when={messages().length > 0}>
        <footer class="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-white via-white/85 to-transparent p-3 dark:from-slate-950 dark:via-slate-950/85">
          {composer()}
        </footer>
      </Show>

      <ModelPicker
        locale={locale()}
        open={showModels()}
        groups={props.modelGroups}
        activeModel={props.modelName}
        onSelect={(model, group) => {
          props.onSelectModel?.(model, group);
          setShowModels(false);
        }}
        onClose={() => setShowModels(false)}
        providers={props.providers}
        managedProviders={props.managedProviders}
        onConnectProvider={props.onConnectProvider}
        onSaveModels={props.onSaveModels}
      />
    </section>
  );
};
