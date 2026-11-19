import { Effect } from "effect";
import type { Component } from "solid-js";

import { loginWithLocalGateway, type LoginSession } from "../../shared/client/login";
import { DEFAULT_LOCALE, translate, type Locale } from "../../shared/ui/src/i18n";
import { LoginPage } from "../../shared/ui/src/login";
import { persistSession } from "./bridge";

/**
 * Electron 渲染进程的默认网关地址。
 *
 * 渲染进程可能从 `file://` 加载，`location.origin` 为 `"null"`，无法作为网关基址，
 * 因此桌面端必须显式传入本机网关地址。
 */
export const DEFAULT_GATEWAY_ORIGIN = "http://127.0.0.1:9528";

export interface DesktopLoginPageProps {
  /** 本地网关地址；默认 127.0.0.1:9528。 */
  origin?: string;
  /** 界面语言；默认中文。 */
  locale?: Locale;
  onSuccess?: (session: LoginSession) => void;
}

/**
 * Electron 登录页：把网关登录实现接到通用 LoginPage 上，成功后通过 preload 桥
 * 把会话交给主进程保存，渲染进程不持久化令牌。
 */
export const DesktopLoginPage: Component<DesktopLoginPageProps> = (props) => {
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
        const session = await Effect.runPromise(
          loginWithLocalGateway(
            { username, password, platform: "electron" },
            { origin: props.origin ?? DEFAULT_GATEWAY_ORIGIN, locale: locale() },
          ),
        );
        void persistSession(session).catch((error) => {
          console.warn("无法把会话交给主进程保存", error);
        });
        props.onSuccess?.(session);
      }}
    />
  );
};
