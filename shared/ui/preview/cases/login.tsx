import { Show, createSignal } from "solid-js";

import { translate, type Locale } from "../../src/i18n";
import { LoginDialog, LoginPage } from "../../src/login";
import type { PreviewCase } from "../types";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function LoginCase(props: { mode: "success" | "error" | "slow"; locale?: Locale }) {
  const [message, setMessage] = createSignal("");
  const locale = () => props.locale ?? "zh-CN";

  return (
    <div class="relative">
      <LoginPage
        locale={locale()}
        validate={({ username, password }) => {
          if (/\s/.test(username)) return translate(locale(), "login.errors.usernameSpace", "用户名不能包含空格");
          if (password.length < 8) return translate(locale(), "login.errors.passwordTooShort", "密码至少 8 个字符");
          return undefined;
        }}
        onSubmit={async ({ username }) => {
          await sleep(props.mode === "slow" ? 3000 : 700);
          if (props.mode === "error") {
            throw new Error(translate(locale(), "login.errors.invalidCredentials", "用户名或密码错误"));
          }
          setMessage(translate(locale(), "login.success", "登录成功：{{ username }}", { username }));
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

const loginDialogCases: PreviewCase[] = [
  {
    id: "login-dialog-zh",
    group: "LoginDialog",
    title: "登录弹窗（带注册）",
    render: () => (
      <div class="relative h-[520px] rounded-xl border border-slate-200 dark:border-white/10">
        <LoginDialog
          open
          serverName="本地开发"
          overlayClass="absolute inset-0"
          onLogin={async () => undefined}
          onRegister={async () => undefined}
        />
      </div>
    ),
  },
  {
    id: "login-dialog-en",
    group: "LoginDialog",
    title: "英文（locale=en-US）",
    render: () => (
      <div class="relative h-[520px] rounded-xl border border-slate-200 dark:border-white/10">
        <LoginDialog
          open
          locale="en-US"
          serverName="Local dev"
          overlayClass="absolute inset-0"
          onLogin={async () => undefined}
          onRegister={async () => undefined}
        />
      </div>
    ),
  },
];

export const loginCases: PreviewCase[] = [
  ...loginDialogCases,
  {
    id: "login-zh",
    group: "LoginPage",
    title: "中文（默认）",
    render: () => <LoginCase mode="success" />,
  },
  {
    id: "login-en",
    group: "LoginPage",
    title: "英文（locale=en-US）",
    render: () => <LoginCase mode="success" locale="en-US" />,
  },
  {
    id: "login-error",
    group: "LoginPage",
    title: "登录失败",
    render: () => <LoginCase mode="error" />,
  },
  {
    id: "login-slow",
    group: "LoginPage",
    title: "慢速提交",
    render: () => <LoginCase mode="slow" />,
  },
];
