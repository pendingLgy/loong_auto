import { Show, createSignal } from "solid-js";

import type { Locale } from "../../src/i18n";
import {
  SettingsAccountSection,
  SettingsNav,
  SettingsPage,
  SettingsProviderSection,
  SettingsServerSection,
  type ConfiguredServer,
  type SettingsSectionKey,
  type SettingsValues,
} from "../../src/settings";
import type { PreviewCase } from "../types";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
        servers={[{ name: "本地开发", serverUrl: "http://127.0.0.1:9528" }]}
        onTestServer={() => undefined}
        onAdd={async () => undefined}
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

function ProviderSectionOnlyCase(props: { locale?: Locale }) {
  return (
    <div class="mx-auto w-full max-w-xl p-4">
      <SettingsProviderSection
        locale={props.locale}
        providers={[{ name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" }]}
        onAdd={async () => undefined}
      />
    </div>
  );
}

function SettingsCase(props: {
  locale?: Locale;
  initialValue?: SettingsValues;
  initialSection?: SettingsSectionKey;
  servers?: ConfiguredServer[];
  fail?: boolean;
}) {
  const [message, setMessage] = createSignal("");

  return (
    <div class="mx-auto w-full max-w-3xl p-4">
      <SettingsPage
        locale={props.locale}
        defaultSection={props.initialSection}
        server={{
          initialValue: props.initialValue,
          servers: props.servers ?? [{ name: "本地开发", serverUrl: "http://127.0.0.1:9528" }],
          onTestServer: (server) => setMessage(`测试连接：${server.serverUrl}`),
          onAdd: async () => {
            await sleep(700);
            if (props.fail) {
              throw new Error("security_token 错误");
            }
            setMessage("配置已保存");
          },
        }}
        provider={{
          providers: [
            { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
          ],
          onAdd: async (values) => {
            setMessage(`添加供应商：${values.name}`);
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
    id: "settings-prefilled",
    group: "SettingsPage",
    title: "带初始值",
    render: () => (
      <SettingsCase
        initialValue={{ name: "本地开发", serverUrl: "http://127.0.0.1:9528", token: "dev-token" }}
      />
    ),
  },
  {
    id: "settings-servers",
    group: "SettingsPage",
    title: "已配置多个服务器",
    render: () => (
      <SettingsCase
        servers={[
          { name: "本地开发", serverUrl: "http://127.0.0.1:9528" },
          { name: "测试环境", serverUrl: "http://127.0.0.1:9530" },
        ]}
      />
    ),
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
    id: "settings-error",
    group: "SettingsPage",
    title: "保存失败",
    render: () => <SettingsCase fail />,
  },
  {
    id: "settings-en",
    group: "SettingsPage",
    title: "英文（locale=en-US）",
    render: () => <SettingsCase locale="en-US" />,
  },
];
