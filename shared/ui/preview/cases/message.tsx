import { For, createSignal } from "solid-js";

import { Message, Toast, type MessageType } from "../../src/message";
import type { PreviewCase } from "../types";

const TYPES: Array<{ type: MessageType; label: string }> = [
  { type: "primary", label: "主要" },
  { type: "success", label: "成功" },
  { type: "warning", label: "警告" },
  { type: "info", label: "信息" },
  { type: "error", label: "错误" },
];

function ToastCase() {
  const [open, setOpen] = createSignal(false);

  return (
    <div class="grid gap-3 p-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        class="w-fit rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500"
      >
        显示自动关闭提示
      </button>
      <Toast
        type="success"
        open={open()}
        duration={2500}
        onClose={() => setOpen(false)}
      >
        操作成功，这条提示会在 2.5 秒后自动关闭。
      </Toast>
    </div>
  );
}

export const messageCases: PreviewCase[] = [
  {
    id: "message-types",
    group: "Message",
    title: "五种类型",
    render: () => (
      <div class="grid gap-3 p-4">
        <For each={TYPES}>
          {(item) => (
            <Message type={item.type}>
              {item.label}类型的消息提示，用于展示对应语义的反馈信息。
            </Message>
          )}
        </For>
      </div>
    ),
  },
  {
    id: "message-toast",
    group: "Message",
    title: "自动关闭的浮动提示",
    render: () => <ToastCase />,
  },
];
