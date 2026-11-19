import { createSignal } from "solid-js";

import type { Locale } from "../../src/i18n";
import {
  ModelPicker,
  type ManagedProvider,
  type ModelGroup,
  type ProviderOption,
} from "../../src/model-picker";
import type { PreviewCase } from "../types";

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

const GROUPS: ModelGroup[] = [
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

function PickerCase(props: { locale?: Locale }) {
  const [open, setOpen] = createSignal(true);
  const [selected, setSelected] = createSignal("gpt-4o");

  return (
    <div class="grid gap-3">
      <div class="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          class="rounded-lg bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500"
        >
          打开模型选择
        </button>
        <span class="text-sm text-slate-500 dark:text-slate-400">当前模型：{selected()}</span>
      </div>

      <ModelPicker
        locale={props.locale}
        open={open()}
        groups={GROUPS}
        activeModel={selected()}
        onSelect={(model) => {
          setSelected(model);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        providers={PROVIDERS}
        managedProviders={MANAGED}
        onConnectProvider={async () => undefined}
        onSaveModels={async () => undefined}
      />
    </div>
  );
}

export const modelPickerCases: PreviewCase[] = [
  {
    id: "model-picker-default",
    group: "ModelPicker",
    title: "默认（按供应商分组）",
    render: () => <PickerCase />,
  },
  {
    id: "model-picker-en",
    group: "ModelPicker",
    title: "英文（locale=en-US）",
    render: () => <PickerCase locale="en-US" />,
  },
];
