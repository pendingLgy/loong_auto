import { createSignal } from "solid-js";

import { ChatPromptInput, type ChatPermission, type ProviderProps } from "../../../src";

function AttachmentMenu(props: {onFile: () => void; onImage: () => void}) {
  return (
    <div class="grid gap-0.5">
      <button
        type="button"
        role="menuitem"
        onClick={props.onFile}
        class="flex h-8 w-full items-center rounded-md px-2 text-left text-[12px] text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        上传文件
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={props.onImage}
        class="flex h-8 w-full items-center rounded-md px-2 text-left text-[12px] text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        上传图片
      </button>
    </div>
  );
}

/** ChatPromptInput 独立预览。 */
export function ChatPromptInputPreview() {
  const [lastPrompt, setLastPrompt] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [permission, setPermission] = createSignal<ChatPermission>("read");
  const [provider, setProvider] = createSignal("deepseek");
  const [model, setModel] = createSignal("chat");
  const providers: ProviderProps[] = [
    {
      provider: "deepseek",
      provider_name: "DeepSeek",
      provider_alias: "DeepSeek",
      models: [
        {model: "chat", thinking: true, thinking_levels: ["low", "medium", "high"]},
        {model: "reasoner", thinking: true, thinking_levels: ["low", "high"]},
      ],
    },
    {
      provider: "openai",
      provider_name: "OpenAI",
      provider_alias: "OpenAI",
      models: [
        {model: "gpt-4o", thinking: false, thinking_levels: []},
      ],
    },
  ];
  const [attachments, setAttachments] = createSignal([
    {id: "1", name: "design.pdf"},
    {id: "2", name: "notes.md"},
  ]);

  return (
    <div class="grid gap-5">
      <div class="grid gap-1">
        <h2 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
          ChatPromptInput
        </h2>
        <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
          附件列表、提示词输入与操作栏。
        </p>
      </div>

      <div class="flex h-[calc(100dvh-16rem)] min-h-[520px] flex-col justify-end overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <ChatPromptInput
          busy={busy()}
          onPause={() => setBusy(false)}
          attachments={attachments()}
          permission={permission()}
          onPermissionChange={setPermission}
          providers={providers}
          provider={provider()}
          model={model()}
          thinking_level="medium"
          model_view={(
            <div class="grid gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setProvider("deepseek");
                  setModel("chat");
                }}
                class="flex h-8 items-center rounded-md px-2 text-left text-[12px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                DeepSeek / chat
              </button>
              <button
                type="button"
                onClick={() => {
                  setProvider("openai");
                  setModel("gpt-4o");
                }}
                class="flex h-8 items-center rounded-md px-2 text-left text-[12px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                OpenAI / gpt-4o
              </button>
            </div>
          )}
          onRemoveAttachment={(id) => setAttachments((current) =>
            current.filter((item) => item.id !== id))}
          onSend={(prompt) => {
            setLastPrompt(prompt);
            setBusy(true);
          }}
          more_view={(
            <AttachmentMenu
              onFile={() => setAttachments((current) => [
                ...current,
                {id: String(Date.now()), name: "attachment.txt"},
              ])}
              onImage={() => setAttachments((current) => [
                ...current,
                {id: String(Date.now()), name: "image.png"},
              ])}
            />
          )}
        />
      </div>

      <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
        当前权限：{permission() === "read" ? "仅查看" : permission() === "edit" ? "可编辑" : "全托管"}
      </p>
      <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
        当前模型：{provider()} / {model()}
      </p>
      <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
        最近发送：{lastPrompt() || "暂无"}
      </p>
    </div>
  );
}
