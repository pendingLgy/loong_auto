import { Effect } from "effect";
import type { Component } from "solid-js";

import { assertLocalGateway, createLocalClient } from "@loong/client";
import { DEFAULT_LOCALE, translate, type Locale } from "@loong/ui/i18n";
import { ServerConfigPage, type ServerConfigValues } from "@loong/ui/server-config";

import { saveServerConfig, serverConfig } from "../storage/server_config";

export interface WebServerConfigPageProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
}

/**
 * Web 服务器配置页：
 * 1. 校验地址必须是本机网关；
 * 2. 调用 `client.health.security_token()` 验证 security_token；
 * 3. 校验通过后写入 `storage/server_config.ts`，由路由守卫跳转。
 */
export const WebServerConfigPage: Component<WebServerConfigPageProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;

  return (
    <ServerConfigPage
      locale={locale()}
      initialValue={serverConfig() ?? undefined}
      validate={({ serverUrl }) => {
        try {
          assertLocalGateway(serverUrl, locale());
          return undefined;
        } catch (error) {
          const reason = error instanceof Error ? error.message : "";
          const base = translate(locale(), "serverConfig.errors.serverUrlInvalid",
            "服务器地址必须是 http/https URL");
          return reason ? `${base}：${reason}` : base;
        }
      }}
      onSubmit={async (values: ServerConfigValues) => {
        const client = createLocalClient({
          origin: values.serverUrl,
          locale: locale(),
          security_token: values.token,
        });
        await Effect.runPromise(client.health.security_token());
        saveServerConfig(values);
      }}
    />
  );
};
