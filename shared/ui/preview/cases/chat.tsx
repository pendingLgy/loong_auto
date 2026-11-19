import { createSignal } from "solid-js";

import type { Locale } from "../../src/i18n";
import { LlmChat, type ChatMessage, type ChatModelGroup } from "../../src/chat";
import type { ManagedProvider, ProviderOption } from "../../src/model-picker";
import type { PreviewCase } from "../types";

const nowMs = Date.now();
const minutesAgo = (minutes: number) => new Date(nowMs - minutes * 60_000).toISOString();
const daysAgo = (days: number) => new Date(nowMs - days * 24 * 60 * 60_000).toISOString();

const SAMPLE_MESSAGES: ChatMessage[] = [
  { id: "1", role: "user", content: "帮我了解一下这个项目。", createdAt: minutesAgo(90) },
  {
    id: "2",
    role: "assistant",
    content: "这是 **Markdown** 渲染示例：\n\n- 支持列表\n- 支持 `行内代码`\n\n```ts\nconst answer = 42;\n```",
    createdAt: minutesAgo(89),
  },
  { id: "3", role: "user", content: "本地网关的默认地址是什么？", createdAt: minutesAgo(30) },
  {
    id: "4",
    role: "assistant",
    content: "本地网关默认运行在 `http://127.0.0.1:9528`，前端通过它访问云端。",
    createdAt: daysAgo(2),
  },
];

const MANY_MESSAGES: ChatMessage[] = Array.from({ length: 200 }, (_, index) => ({
  id: `m-${index}`,
  role: index % 2 === 0 ? "user" : "assistant",
  createdAt: minutesAgo((200 - index) * 10),
  content: index % 2 === 0
    ? `这是第 ${index + 1} 条用户消息，用来演示虚拟滚动的长列表效果。`
    : `这是第 ${index + 1} 条助手回复：\n\n- 支持 **Markdown**\n- 用于检查异步渲染后的行高测量\n\n\`\`\`ts\nconst answer = ${index + 1};\n\`\`\``,
}));

const PROVIDERS: ProviderOption[] = [
  { name: "OpenAI", description: "GPT 系列模型", baseUrl: "https://api.openai.com/v1" },
  { name: "Anthropic", description: "Claude 系列模型", baseUrl: "https://api.anthropic.com" },
  { name: "DeepSeek", description: "DeepSeek 系列模型", baseUrl: "https://api.deepseek.com" },
];

const MANAGED: ManagedProvider[] = [
  {
    providerName: "OpenAI",
    providerAlias: "我的 OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", modelName: "GPT-4o", enabled: true },
      { id: "gpt-4o-mini" },
      { id: "o3" },
    ],
  },
  {
    providerName: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: [
      { id: "deepseek-chat", enabled: true },
      { id: "deepseek-reasoner" },
    ],
  },
];

const MODEL_GROUPS: ChatModelGroup[] = [
  {
    providerName: "OpenAI",
    providerAlias: "我的 OpenAI",
    models: [
      { id: "gpt-4o", modelName: "GPT-4o", enabled: true },
      { id: "gpt-4o-mini", modelName: "GPT-4o mini", enabled: true },
      { id: "o3", modelName: "o3", enabled: false },
    ],
  },
  {
    providerName: "DeepSeek",
    models: [
      { id: "deepseek-chat", enabled: true },
      { id: "deepseek-reasoner", modelName: "DeepSeek Reasoner", enabled: false },
    ],
  },
];

function ChatCase(props: {
  locale?: Locale;
  initial?: ChatMessage[];
  streaming?: boolean;
}) {
  const [messages, setMessages] = createSignal<ChatMessage[]>(props.initial ?? []);
  const [streaming, setStreaming] = createSignal(props.streaming ?? false);
  const [providerAlias, setProviderAlias] = createSignal("我的 OpenAI");
  const [modelName, setModelName] = createSignal("gpt-4o");
  let nextId = (props.initial?.length ?? 0) + 1;

  return (
    <div class="h-[calc(100vh-40.5px)] overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <LlmChat
        locale={props.locale}
        messages={messages()}
        streaming={streaming()}
        providerAlias={providerAlias()}
        modelName={modelName()}
        modelGroups={MODEL_GROUPS}
        providers={PROVIDERS}
        managedProviders={MANAGED}
        onConnectProvider={async () => undefined}
        onSaveModels={async () => undefined}
        onSelectModel={(model, group) => {
          setProviderAlias(group.providerAlias?.trim() || group.providerName);
          setModelName(model);
        }}
        onAdd={() => undefined}
        onSend={(content) => {
          setMessages([
        ...messages(),
        { id: String(nextId++), role: "user", content, createdAt: new Date().toISOString() },
      ]);
          setStreaming(true);
          window.setTimeout(() => {
            setMessages((current) => [
              ...current,
              {
          id: String(nextId++),
          role: "assistant",
          content: "收到，这是示例回复。",
          createdAt: new Date().toISOString(),
        },
            ]);
            setStreaming(false);
          }, 900);
        }}
        onStop={() => setStreaming(false)}
      />
    </div>
  );
}

export const chatCases: PreviewCase[] = [
  {
    id: "chat-default",
    group: "LlmChat",
    title: "带历史消息",
    render: () => <ChatCase initial={SAMPLE_MESSAGES} />,
  },
  {
    id: "chat-empty",
    group: "LlmChat",
    title: "空对话",
    render: () => <ChatCase />,
  },
  {
    id: "chat-streaming",
    group: "LlmChat",
    title: "生成中（可停止）",
    render: () => <ChatCase initial={SAMPLE_MESSAGES} streaming />,
  },
  {
    id: "chat-many",
    group: "LlmChat",
    title: "长列表（虚拟滚动）",
    render: () => <ChatCase initial={MANY_MESSAGES} />,
  },
  {
    id: "chat-en",
    group: "LlmChat",
    title: "英文（locale=en-US）",
    render: () => <ChatCase locale="en-US" initial={SAMPLE_MESSAGES} />,
  },
];
