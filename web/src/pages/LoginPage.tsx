import { Effect } from "effect";
import type { Component } from "solid-js";

import type { LoginResponse } from "@loong/client";
import { DEFAULT_LOCALE, translate, type Locale } from "@loong/ui/i18n";
import { LoginPage } from "@loong/ui/login";

import { createApiClient } from "../api";
import { saveUser } from "../storage/user";

export interface WebLoginPageProps {
  /** 本地网关地址；Web 由网关托管时可省略，默认使用页面 origin。 */
  origin?: string;
  /** 界面语言；默认中文。 */
  locale?: Locale;
  onSuccess?: (session: LoginResponse) => void;
}

/** Web 登录页：通过 `@loong/client` 的 `auth.login` 接口登录，文案由共享 i18n 提供。 */
export const WebLoginPage: Component<WebLoginPageProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;

  return (
    <LoginPage
      locale={locale()}
      validate={({ username, password }) => {
        if (/\s/.test(username)) return translate(locale(), "login.errors.usernameSpace", "用户名不能包含空格");
        if (password.length < 8) return translate(locale(), "login.errors.passwordTooShort", "密码至少 8 个字符");
        return undefined;
      }}
      onSubmit={async ({ username, password }) => {
        const client = createApiClient({ origin: props.origin, locale: locale() });
        const session = await Effect.runPromise(
          client.auth.login({ username, password, platform: "web" }),
        );
        saveUser(session);
        props.onSuccess?.(session);
      }}
    />
  );
};
