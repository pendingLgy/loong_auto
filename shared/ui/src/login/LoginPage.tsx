import { createSignal, onCleanup, Show, type Component, type JSX } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginPageProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 业务校验；返回文案表示不通过，返回 undefined 表示通过。 */
  validate?: (credentials: LoginCredentials) => string | undefined;
  /** 提交登录；抛出的 Error.message 会展示在表单里。 */
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  onSuccess?: () => void;
  disabled?: boolean;
  autofocus?: boolean;
}

/**
 * 通用登录表单：只负责输入、校验展示、提交与错误展示，不绑定网关、平台或会话类型。
 * 所有可见文案直接内联调用 `translate(locale, key, fallback)` 获取，通过 `locale` 切换语言；
 * 具体登录实现由调用方通过 `onSubmit` 注入。
 */
export const LoginPage: Component<LoginPageProps> = (props) => {
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal("");

  const locale = () => props.locale ?? DEFAULT_LOCALE;

  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    if (pending() || props.disabled) return;

    const credentials: LoginCredentials = {
      username: username().trim(),
      password: password(),
    };

    if (!credentials.username) {
      setError(translate(locale(), "login.errors.usernameRequired", "请输入用户名"));
      return;
    }
    if (!credentials.password) {
      setError(translate(locale(), "login.errors.passwordRequired", "请输入密码"));
      return;
    }
    const validationError = props.validate?.(credentials);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setPending(true);

    void props.onSubmit(credentials)
      .then(() => {
        if (disposed) return;
        setPending(false);
        setPassword("");
        props.onSuccess?.();
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        setPending(false);
        setError(cause instanceof Error && cause.message
          ? cause.message
          : translate(locale(), "login.errors.fallback", "登录失败，请稍后再试"));
      });
  };

  return (
    <main class="grid min-h-screen place-items-center bg-linear-to-br from-sky-50 via-white to-slate-100 p-6 text-slate-900 dark:from-slate-900 dark:via-slate-950 dark:to-black dark:text-slate-100">
      <form
        class="grid w-full max-w-sm gap-[18px] rounded-2xl border border-slate-200 bg-white/90 p-7 shadow-2xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/50"
        onSubmit={handleSubmit}
        aria-label={translate(locale(), "login.title", "登录 Loong")}
        aria-busy={pending()}
      >
        <header>
          <h1 class="m-0 text-2xl tracking-tight">
            {translate(locale(), "login.title", "登录 Loong")}
          </h1>
          <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {translate(locale(), "login.description", "使用你的 Loong 账号继续")}
          </p>
        </header>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "login.username", "用户名")}
          </span>
          <input
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100"
            name="username"
            type="text"
            autocomplete="username"
            maxlength={128}
            required
            autofocus={props.autofocus}
            disabled={pending() || props.disabled}
            value={username()}
            onInput={(event) => setUsername(event.currentTarget.value)}
          />
        </label>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "login.password", "密码")}
          </span>
          <input
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100"
            name="password"
            type="password"
            autocomplete="current-password"
            maxlength={256}
            required
            disabled={pending() || props.disabled}
            value={password()}
            onInput={(event) => setPassword(event.currentTarget.value)}
          />
        </label>

        <Show when={error()}>
          <p
            class="m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400"
            role="alert"
            aria-live="assertive"
          >
            {error()}
          </p>
        </Show>

        <button
          class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3.5 py-2.5 text-[15px] font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
          type="submit"
          disabled={pending() || props.disabled}
        >
          {pending()
            ? translate(locale(), "login.pending", "登录中…")
            : translate(locale(), "login.submit", "登录")}
        </button>
      </form>
    </main>
  );
};
