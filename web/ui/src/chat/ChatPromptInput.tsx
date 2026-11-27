import {createSignal, For, Show} from "solid-js";
import type {JSX} from "@solidjs/web";

import {PauseIcon, PlusIcon, SendIcon} from "../assets/icons";
import {useUiI18n} from "../i18n";


export interface ChatAttachment {
  id: string;
  name: string;
}

export type ChatPermission = "read" | "edit" | "full";

export interface ModelProps {
  model: string;
  thinking: boolean;
  thinking_levels: string[];
}

export interface ProviderProps {
  provider: string;
  provider_name: string;
  provider_alias: string;
  models: ModelProps[];
}

export interface ChatPromptInputProps {
  promptLabel?: string;
  placeholder?: string;
  sendLabel?: string;
  pauseLabel?: string;
  onSend?: (prompt: string) => void;
  /** 正在生成时显示暂停按钮。 */
  busy?: boolean;
  onPause?: () => void;
  /** 已上传附件列表。 */
  attachments?: ChatAttachment[];
  onRemoveAttachment?: (id: string) => void;
  /** 点击加号后显示的内容。 */
  more_view?: JSX.Element;
  /** 受控操作权限。 */
  permission?: ChatPermission;
  /** 非受控默认权限，默认仅查看。 */
  defaultPermission?: ChatPermission;
  onPermissionChange?: (permission: ChatPermission) => void;
  permissionLabel?: string;
  permissionReadLabel?: string;
  permissionEditLabel?: string;
  permissionFullLabel?: string;
  /** 模型选择子组件。 */
  model_view?: JSX.Element;
  providers?: ProviderProps[];
  /** 默认选中的供应商 ID。 */
  provider?: string;
  /** 默认选中的模型 ID。 */
  model?: string;
  /** 默认思考等级。 */
  thinking_level?: string;
}

/** 聊天提示词输入区：附件、输入框与操作栏。 */
export function ChatPromptInput(props: ChatPromptInputProps) {
  const {t} = useUiI18n();
  const [hasContent, setHasContent] = createSignal(false);
  const [attachMenuOpen, setAttachMenuOpen] = createSignal(false);
  const [permissionMenuOpen, setPermissionMenuOpen] = createSignal(false);
  const [modelMenuOpen, setModelMenuOpen] = createSignal(false);
  const providers = () => props.providers ?? [];
  const currentProvider = () => providers().find((item) => item.provider === props.provider)
    ?? providers()[0];
  const currentModel = () => currentProvider()?.models.find((item) => item.model === props.model)
    ?? currentProvider()?.models[0];
  const [thinkingMenuOpen, setThinkingMenuOpen] = createSignal(false);
  const [selectedThinkingLevel, setSelectedThinkingLevel] = createSignal<string | null>(
    props.thinking_level && (currentModel()?.thinking_levels ?? []).includes(props.thinking_level)
      ? props.thinking_level : null,
  );
  const thinkingLevels = () => currentModel()?.thinking_levels ?? [];
  const thinkingLevel = () => {
    const selected = selectedThinkingLevel();
    return selected && thinkingLevels().includes(selected)
      ? selected : thinkingLevels()[0] ?? "";
  };
  const providerName = () => {
    const provider = currentProvider();
    return provider?.provider_alias
      || provider?.provider_name
      || provider?.provider
      || props.provider;
  };

  const modelName = () => currentModel()?.model || props.model;

  const modelText = () => [providerName(), modelName()]
    .filter(Boolean)
    .join("/") || t("chat.modelPlaceholder", "供应商/模型");

  const [internalPermission, setInternalPermission] = createSignal<ChatPermission>(props.defaultPermission ?? "read");
  const permission = () => props.permission ?? internalPermission();
  const permissionOptions = () => [
    {key: "read" as const, label: props.permissionReadLabel ?? t("chat.permission.read", "仅查看")},
    {key: "edit" as const, label: props.permissionEditLabel ?? t("chat.permission.edit", "可编辑")},
    {key: "full" as const, label: props.permissionFullLabel ?? t("chat.permission.full", "全托管")},
  ];
  const currentPermissionLabel = () =>
    permissionOptions().find((option) => option.key === permission())?.label ?? t("chat.permission.read", "仅查看");
  const changePermission = (value: ChatPermission) => {
    if (props.permission === undefined) setInternalPermission(value);
    props.onPermissionChange?.(value);
    setPermissionMenuOpen(false);
  };
  let editor: HTMLDivElement | undefined;

  const readText = () => editor?.innerText.trim() ?? "";

  const updateContent = () => {
    setHasContent(Boolean(readText()));
  };

  const insertPlainText = (text: string) => {
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection) return;

    if (!selection.rangeCount || !editor.contains(selection.anchorNode)) {
      editor.focus();
      const end = document.createRange();
      end.selectNodeContents(editor);
      end.collapse(false);
      selection.removeAllRanges();
      selection.addRange(end);
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    updateContent();
  };

  const send = () => {
    if (props.busy) {
      props.onPause?.();
      return;
    }
    const value = readText();
    if (!value) return;
    props.onSend?.(value);
    if (editor) editor.innerHTML = "";
    setHasContent(false);
    editor?.focus();
  };

  return (
    <div
      class="shrink-0 border-t border-slate-200 bg-white/90 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div
        class="relative grid gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-sm transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950">
        <Show when={props.attachments?.length}>
          <div class="flex flex-wrap gap-1.5 px-0.5">
            <For each={props.attachments}>
              {(attachment) => (
                <span
                  class="inline-flex max-w-48 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <span class="min-w-0 truncate">{attachment.name}</span>
                  <Show when={props.onRemoveAttachment}>
                    <button
                      type="button"
                      aria-label={t("chat.removeAttachment", "移除 {name}", {name: attachment.name})}
                      onClick={() => props.onRemoveAttachment?.(attachment.id)}
                      class="shrink-0 text-slate-400 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:hover:text-slate-200"
                    >
                      ✕
                    </button>
                  </Show>
                </span>
              )}
            </For>
          </div>
        </Show>

        <div
          ref={editor}
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          aria-label={props.promptLabel ?? t("chat.prompt", "提示词")}
          data-placeholder={props.placeholder ?? t("chat.promptPlaceholder", "输入提示词…")}
          data-empty={hasContent() ? "false" : "true"}
          onInput={updateContent}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData?.getData("text/plain") ?? "";
            if (!text) return;
            insertPlainText(text);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
            event.preventDefault();
            send();
          }}
          class="max-h-60 min-h-20 overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-1.5 py-1.5 text-[13px] leading-6 text-slate-700 outline-none data-[empty=true]:before:pointer-events-none data-[empty=true]:before:text-slate-400 data-[empty=true]:before:content-[attr(data-placeholder)] dark:text-slate-200"
        />

        <div class="flex min-h-9 items-center justify-between gap-2">
          <div class="flex min-w-0 flex-1 items-center gap-1">
            <Show when={props.more_view}>
              <button
                type="button"
                onClick={() => {
                  setPermissionMenuOpen(false);
                  setAttachMenuOpen((open) => !open);
                }}
                aria-label={t("common.more", "更多")}
                aria-haspopup="menu"
                aria-expanded={attachMenuOpen() ? "true" : "false"}
                title={t("common.more", "更多")}
                class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <PlusIcon
                  class={`h-4 w-4 transition-transform ${attachMenuOpen() ? "rotate-45" : ""}`}/>
              </button>
              <Show when={attachMenuOpen()}>
                <div
                  class="fixed inset-0 z-[55]"
                  aria-hidden="true"
                  onClick={() => setAttachMenuOpen(false)}
                />
                <div
                  class="absolute bottom-full left-0 z-[60] mb-2 min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {props.more_view}
                </div>
              </Show>
            </Show>
            <div class="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAttachMenuOpen(false);
                  setPermissionMenuOpen((open) => !open);
                }}
                aria-label={props.permissionLabel ?? t("chat.permission", "操作权限")}
                aria-haspopup="menu"
                aria-expanded={permissionMenuOpen() ? "true" : "false"}
                title={props.permissionLabel ?? t("chat.permission", "操作权限")}
                class="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[11px] text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                {currentPermissionLabel()}
                <span class="text-[9px] opacity-60" aria-hidden="true">▾</span>
              </button>

              <Show when={permissionMenuOpen()}>
                <div
                  class="fixed inset-0 z-[55]"
                  aria-hidden="true"
                  onClick={() => setPermissionMenuOpen(false)}
                />
                <div
                  role="menu"
                  class="absolute bottom-full left-1/2 z-[60] mb-1 w-max -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                  <For each={permissionOptions()}>
                    {(option) => (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => changePermission(option.key)}
                        class="flex h-8 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-[12px] text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <span>{option.label}</span>
                        <span class="w-3 shrink-0 text-center text-indigo-500" aria-hidden="true">
                          {permission() === option.key ? "✓" : ""}
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
            <Show when={props.model_view}>
              <div class="relative min-w-0 shrink">
                <button
                  type="button"
                  onClick={() => {
                    setAttachMenuOpen(false);
                    setPermissionMenuOpen(false);
                    setThinkingMenuOpen(false);
                    setModelMenuOpen((open) => !open);
                  }}
                  aria-label={modelText()}
                  aria-haspopup="menu"
                  aria-expanded={modelMenuOpen() ? "true" : "false"}
                  title={modelText()}
                  class="inline-flex h-9 max-w-36 min-w-0 items-center gap-1 rounded-lg px-2 text-[11px] text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <span class="truncate">{modelText()}</span>
                  <span class="shrink-0 text-[9px] opacity-60" aria-hidden="true">▾</span>
                </button>
                <Show when={modelMenuOpen()}>
                  <div
                    class="fixed inset-0 z-[55]"
                    aria-hidden="true"
                    onClick={() => setModelMenuOpen(false)}
                  />
                  <div
                    class="absolute bottom-full right-0 z-[60] mb-1 min-w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                    onClick={() => setModelMenuOpen(false)}
                  >
                    {props.model_view}
                  </div>
                </Show>
              </div>

              <Show when={currentModel()?.thinking && thinkingLevels().length}>
                <div class="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAttachMenuOpen(false);
                      setPermissionMenuOpen(false);
                      setModelMenuOpen(false);
                      setThinkingMenuOpen((open) => !open);
                    }}
                    aria-label={thinkingLevel()}
                    aria-haspopup="menu"
                    aria-expanded={thinkingMenuOpen() ? "true" : "false"}
                    title={thinkingLevel()}
                    class="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    {thinkingLevel()}
                  </button>
                  <Show when={thinkingMenuOpen()}>
                    <div
                      class="fixed inset-0 z-[55]"
                      aria-hidden="true"
                      onClick={() => setThinkingMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      class="absolute bottom-full left-1/2 z-[60] mb-1 w-24 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                    >
                      <For each={thinkingLevels()}>
                        {(level) => (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setSelectedThinkingLevel(level);
                              setThinkingMenuOpen(false);
                            }}
                            class="flex h-8 w-full items-center justify-between rounded-md px-2 text-left text-[12px] text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <span>{level}</span>
                            <Show when={thinkingLevel() === level}>
                              <span class="text-indigo-500" aria-hidden="true">✓</span>
                            </Show>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
            </Show>
          </div>

          <button
            type="button"
            onClick={send}
            disabled={!props.busy && !hasContent()}
            aria-label={props.busy ? (props.pauseLabel ?? t("chat.pause", "暂停")) : (props.sendLabel ?? t("chat.send", "发送"))}
            title={props.busy ? (props.pauseLabel ?? t("chat.pause", "暂停")) : (props.sendLabel ?? t("chat.send", "发送"))}
            class={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg outline-none transition focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              props.busy
                ? "bg-slate-700 text-white hover:bg-slate-600 focus-visible:ring-slate-500/40"
                : "bg-indigo-500 text-white hover:bg-indigo-600 focus-visible:ring-indigo-500/40"
            }`}
          >
            {props.busy
              ? <PauseIcon class="h-4 w-4"/>
              : <SendIcon class="h-4 w-4"/>}
          </button>
        </div>

      </div>
    </div>
  );
}
