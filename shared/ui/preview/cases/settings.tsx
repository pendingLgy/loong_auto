import { Show, createSignal } from "solid-js";

import type { Locale } from "../../src/i18n";
import {
  SettingsAccountSection,
  SettingsModelSection,
  SettingsNav,
  SettingsPage,
  SettingsProviderSection,
  SettingsServerSection,
  type ConfiguredServer,
  type SettingsSectionKey,
} from "../../src/settings";
import type { PreviewCase } from "../types";

const POPULAR_PROVIDERS = [
  { name: "OpenAI", description: "GPT 系列模型", baseUrl: "https://api.openai.com/v1" },
  { name: "Anthropic", description: "Claude 系列模型", baseUrl: "https://api.anthropic.com" },
];

const ALL_PROVIDERS = [
  ...POPULAR_PROVIDERS,
  { name: "DeepSeek", description: "DeepSeek 系列模型", baseUrl: "https://api.deepseek.com" },
  { name: "Google", description: "Gemini 系列模型", baseUrl: "https://generativelanguage.googleapis.com" },
];

function NavOnlyCase(props: { locale?: Locale }) {
  const [active, setActive] = createSignal<SettingsSectionKey>("server");

  return (
    <div class="w-56">
      <SettingsNav locale={props.locale} active={active()} onSelect={setActive} />
    </div>
  );
}

function ServerSectionOnlyCase(props: { locale?: Locale }) {
  return (
    <div class="mx-auto w-full max-w-xl p-4">
      <SettingsServerSection
        locale={props.locale}
        server={{ name: "本地开发", serverUrl: "http://127.0.0.1:9528" }}
        onTestServer={() => undefined}
      />
    </div>
  );
}

function AccountSectionOnlyCase(props: { locale?: Locale }) {
  return (
    <div class="mx-auto w-full max-w-xl p-4">
      <SettingsAccountSection
        locale={props.locale}
        userName="Loong"
        username="loong@example.com"
      />
    </div>
  );
}

function ModelSectionOnlyCase(props: { locale?: Locale }) {
  return (
    <div class="mx-auto w-full max-w-xl p-4">
      <SettingsModelSection
        locale={props.locale}
        providers={[
          {
            providerName: "OpenAI",
            alias: "我的 OpenAI",
            baseUrl: "https://api.openai.com/v1",
            models: [
              { id: "gpt-4o", enabled: true },
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
        ]}
      />
    </div>
  );
}

function ProviderSectionOnlyCase(props: { locale?: Locale }) {
  return (
    <div class="mx-auto w-full max-w-xl p-4">
      <SettingsProviderSection
        locale={props.locale}
        providers={[{ name: "OpenAI", alias: "我的 OpenAI", baseUrl: "https://api.openai.com/v1" }]}
        popular={POPULAR_PROVIDERS}
        allProviders={ALL_PROVIDERS}
        onAdd={async () => undefined}
      />
    </div>
  );
}

function SettingsCase(props: {
  locale?: Locale;
  initialSection?: SettingsSectionKey;
  servers?: ConfiguredServer[];
}) {
  const [message, setMessage] = createSignal("");

  return (
    <div class="mx-auto w-full max-w-3xl p-4">
      <SettingsPage
        locale={props.locale}
        defaultSection={props.initialSection}
        onBack={()=>{}}
        server={{
          server: (props.servers ?? [{ name: "本地开发", serverUrl: "http://127.0.0.1:9528" }])[0],
          onTestServer: (server) => setMessage(`测试连接：${server.serverUrl}`),
        }}
        model={{
          providers: [
            {
              providerName: "OpenAI",
              alias: "我的 OpenAI",
              baseUrl: "https://api.openai.com/v1",
              models: [
                { id: "gpt-4o", enabled: true },
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
          ],
          onSaveModels: async (provider, models) => {
            const enabled = models.filter((item) => item.enabled).length;
            setMessage(`${provider.providerName}：已启用 ${enabled} 个模型`);
          },
        }}
        provider={{
          providers: [
            { name: "OpenAI", alias: "我的 OpenAI", baseUrl: "https://api.openai.com/v1" },
          ],
          onEditProvider: (provider) => setMessage(`编辑供应商：${provider.name}`),
          onUpdateApiKey: async (provider) => {
            setMessage(`修改 API Key：${provider.name}`);
          },
          onRenameProvider: async (provider, alias) => {
            setMessage(`重命名供应商：${provider.name} → ${alias}`);
          },
          onDeleteProvider: (provider) => setMessage(`移除供应商：${provider.alias || provider.name}`),
          popular: POPULAR_PROVIDERS,
          allProviders: ALL_PROVIDERS,
          onSelectPopular: (provider) => setMessage(`选择热门供应商：${provider.name}`),
          onSelectAllProvider: (provider) => setMessage(`选择全部供应商：${provider.name}`),
          onAdd: async (values) => {
            setMessage(`添加供应商：${values.alias || values.name}`);
          },
        }}
        account={{
          userName: "Loong",
          username: "loong@example.com",
          onLogout: () => setMessage("已退出登录"),
        }}
      />
      <Show when={message()}>
        <p class="m-0 mt-3 text-sm text-slate-500 dark:text-slate-400">{message()}</p>
      </Show>
    </div>
  );
}

export const settingsCases: PreviewCase[] = [
  {
    id: "settings-nav",
    group: "SettingsPage",
    title: "仅左侧导航（SettingsNav）",
    render: () => <NavOnlyCase />,
  },
  {
    id: "settings-server-section",
    group: "SettingsPage",
    title: "仅服务器内容（SettingsServerSection）",
    render: () => <ServerSectionOnlyCase />,
  },
  {
    id: "settings-model-section",
    group: "SettingsPage",
    title: "仅模型内容（SettingsModelSection）",
    render: () => <ModelSectionOnlyCase />,
  },
  {
    id: "settings-provider-section",
    group: "SettingsPage",
    title: "仅供应商内容（SettingsProviderSection）",
    render: () => <ProviderSectionOnlyCase />,
  },
  {
    id: "settings-account-section",
    group: "SettingsPage",
    title: "仅账号内容（SettingsAccountSection）",
    render: () => <AccountSectionOnlyCase />,
  },
  {
    id: "settings-default",
    group: "SettingsPage",
    title: "默认",
    render: () => <SettingsCase />,
  },
  {
    id: "settings-servers",
    group: "SettingsPage",
    title: "服务器信息",
    render: () => (
      <SettingsCase servers={[{ name: "本地开发", serverUrl: "http://127.0.0.1:9528" }]} />
    ),
  },
  {
    id: "settings-model",
    group: "SettingsPage",
    title: "模型分组",
    render: () => <SettingsCase initialSection="model" />,
  },
  {
    id: "settings-provider",
    group: "SettingsPage",
    title: "模型供应商分组",
    render: () => <SettingsCase initialSection="provider" />,
  },
  {
    id: "settings-account",
    group: "SettingsPage",
    title: "账号分组",
    render: () => <SettingsCase initialSection="account" />,
  },
  {
    id: "settings-en",
    group: "SettingsPage",
    title: "英文（locale=en-US）",
    render: () => <SettingsCase locale="en-US" />,
  },
];
