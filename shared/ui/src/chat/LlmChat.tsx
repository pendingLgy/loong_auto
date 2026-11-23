import { For, Show, createEffect, createSignal, onCleanup, type Component, type JSX } from "solid-js";

import { createVirtualizer } from "@tanstack/solid-virtual";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import { PlusIcon, SendIcon, StopIcon } from "../icon";
import { MessageRow } from "./MessageRow";
import type { ChatMessage } from "./types";
import {
  ModelPicker,
  type ConnectValues,
  type ManagedModel,
  type ManagedProvider,
  type ModelGroup,
  type ProviderOption,
} from "../model-picker";




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
  /** 点击模型选择器。 */
  onOpenModels?: () => void;
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
  /** 切换单个模型启用状态。 */
  onToggleModel?: (provider: ManagedProvider, model: ManagedModel, enabled: boolean) => Promise<void>;
  /** 点击输入区下方「+」按钮。 */
  onAdd?: () => void;
  /** 消息列表滚动到顶部附近。 */
  onScrollTop?: () => void;
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
  const [stickToBottom, setStickToBottom] = createSignal(true);
  const canSend = () => hasContent() && !props.disabled && !props.streaming;

  const virtualizer = createVirtualizer({
    get count() {
      return messages().length;
    },
    getScrollElement: () => scroller ?? null,
    estimateSize: () => 64,
    gap: 24, // 统一控制每条消息行之间的间距（如 24px）
    overscan: 8,
  });

  const modelInfo = () => {
    const provider = props.providerAlias?.trim() ?? "";
    const model = props.modelName?.trim() ?? "";
    if (provider && model) return `${provider} / ${model}`;
    return provider || model || translate(locale(), "chat.noModel", "未选择模型");
  };

  let previousCount = 0;
  let previousFirstId: string | undefined;
  let bottomFrame: number | undefined;

  const scrollToBottom = () => {
    setStickToBottom(true);
    if (bottomFrame !== undefined) cancelAnimationFrame(bottomFrame);
    const apply = () => {
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    };
    requestAnimationFrame(() => {
      apply();
      bottomFrame = requestAnimationFrame(apply);
    });
  };

  onCleanup(() => {
    if (bottomFrame !== undefined) cancelAnimationFrame(bottomFrame);
  });

  createEffect(() => {
    const list = messages();
    const count = list.length;
    const firstId = list[0]?.id;
    const prepended = previousCount > 0
      && count > previousCount
      && firstId !== previousFirstId;

    previousCount = count;
    previousFirstId = firstId;
    props.streaming;

    if (prepended) {
      setStickToBottom(false);
      return;
    }
    if (count === 0) return;
    virtualizer.scrollToIndex(count - 1, { align: "end" });
    scrollToBottom();
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
      if (stickToBottom()) scrollToBottom();
    });
  };

  onCleanup(() => {
    if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
  });


  const handlePaste = (event: ClipboardEvent) => {
    event.preventDefault();

    const clipboardData = event.clipboardData;
    const plainText = clipboardData?.getData("text/plain") ?? "";
    if (!plainText) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // 兜底：若没有选区，直接追加到末尾
      input?.append(document.createTextNode(plainText));
      syncContent();
      return;
    }

    const range = selection.getRangeAt(0);
    // 仅当选区位于当前输入框内时才操作，避免误改外部节点
    if (input && !input.contains(range.commonAncestorContainer)) {
      return;
    }

    range.deleteContents();
    const textNode = document.createTextNode(plainText);
    range.insertNode(textNode);

    // 将光标移动到刚插入文本的末尾
    const nextRange = document.createRange();
    nextRange.setStartAfter(textNode);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);

    syncContent();
  };

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
        class="max-h-32 min-h-12 overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-2 py-1 text-sm text-slate-900 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 aria-disabled:opacity-60 dark:text-slate-100 dark:empty:before:text-slate-500"
        onInput={syncContent}
        onPaste={handlePaste}
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
          <PlusIcon class="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            props.onOpenModels?.();
            setShowModels(true);
          }}
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
      class={`relative flex h-full min-h-0 w-full flex-col ${props.class ?? ""}`}
      style={{ "--chat-max-width": `max(60%, ${props.minWidth ?? 320}px)` }}
    >
      <div
        ref={scroller}
        class={`w-full flex-1 overflow-y-auto p-4 ${messages().length > 0 ? "pb-44" : ""}`}
        onScroll={(event) => {
          const element = event.currentTarget;
          setStickToBottom(
            element.scrollHeight - element.scrollTop - element.clientHeight <= 18,
          );
          if (element.scrollTop <= 32) {
            props.onScrollTop?.();
          }
        }}
      >
        <div class={`mx-auto flex w-full max-w-[var(--chat-max-width)] flex-col ${messages().length === 0 ? "h-full" : ""}`}>
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
                  class="absolute left-0 top-0 w-full"
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

            {/*<div class="h-36 shrink-0" aria-hidden="true" />*/}

        </Show>

        </div>
      </div>

      <footer
        class={`pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-white via-white/85 to-transparent p-3 dark:from-slate-950 dark:via-slate-950/85 ${messages().length > 0 ? "" : "hidden"}`}
      >
        <Show when={messages().length > 0}>
          <div class="mx-auto w-full max-w-[var(--chat-max-width)]">
            {composer()}
          </div>
        </Show>
      </footer>

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
        onToggleModel={props.onToggleModel}
      />
    </section>
  );
};
