import { Show, createSignal } from "solid-js";

import { translate, type Locale } from "../../src/i18n";
import { ServerConfigPage, type ServerConfigValues } from "../../src/server-config";
import type { PreviewCase } from "../types";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function ServerConfigCase(props: {
  mode: "success" | "error" | "slow";
  locale?: Locale;
  initialValue?: ServerConfigValues;
}) {
  const [message, setMessage] = createSignal("");
  const locale = () => props.locale ?? "zh-CN";

  return (
    <div class="relative">
      <ServerConfigPage
        locale={locale()}
        initialValue={props.initialValue}
        onSubmit={async () => {
          await sleep(props.mode === "slow" ? 3000 : 700);
          if (props.mode === "error") {
            throw new Error(translate(locale(), "serverConfig.errors.fallback", "保存失败，请稍后再试"));
          }
          setMessage(translate(locale(), "serverConfig.success", "配置已保存"));
        }}
      />
      <Show when={message()}>
        <output class="fixed bottom-6 left-1/2 -translate-x-1/2 text-sm text-blue-300">
          {message()}
        </output>
      </Show>
    </div>
  );
}

export const serverConfigCases: PreviewCase[] = [
  {
    id: "server-config-default",
    group: "ServerConfigPage",
    title: "中文（默认）",
    render: () => <ServerConfigCase mode="success" />,
  },
  {
    id: "server-config-prefilled",
    group: "ServerConfigPage",
    title: "带初始值",
    render: () => (
      <ServerConfigCase
        mode="success"
        initialValue={{ serverUrl: "http://127.0.0.1:9528", token: "dev-token" }}
      />
    ),
  },
  {
    id: "server-config-error",
    group: "ServerConfigPage",
    title: "保存失败",
    render: () => <ServerConfigCase mode="error" />,
  },
  {
    id: "server-config-slow",
    group: "ServerConfigPage",
    title: "慢速保存",
    render: () => <ServerConfigCase mode="slow" />,
  },
  {
    id: "server-config-en",
    group: "ServerConfigPage",
    title: "英文（locale=en-US）",
    render: () => <ServerConfigCase mode="success" locale="en-US" />,
  },
];
