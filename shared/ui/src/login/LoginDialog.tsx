import { Show, createSignal, type Component, type JSX } from "solid-js";

import { Dialog } from "../dialog";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";
import type { LoginCredentials } from "./LoginPage";

export interface RegisterValues extends LoginCredentials {
  name?: string;
}

export interface LoginDialogProps {
  /** 是否显示。 */
  open: boolean;
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 服务器名称，显示在标题下方。 */
  serverName?: string;
  /** 遮罩定位类名；默认全屏，传 absolute inset-0 可限制在父容器内。 */
  overlayClass?: string;
  /** 登录成功后回调。 */
  onSuccess?: () => void;
  /** 关闭回调；默认不可关闭。 */
  onClose?: () => void;
  /** 是否允许关闭，默认 false。 */
  closable?: boolean;
  /** 登录；抛出的 Error.message 会展示在表单里。 */
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  /** 注册；成功后自动调用 onLogin。 */
  onRegister: (values: RegisterValues) => Promise<void>;
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 aria-invalid:border-red-500 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-500/30 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100";

type Mode = "login" | "register";

/** 登录 / 注册弹窗：未登录时可由页面强制展示，登录成功前保持打开。 */
export const LoginDialog: Component<LoginDialogProps> = (props) => {
  const [mode, setMode] = createSignal<Mode>("login");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [name, setName] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal("");
  const [fieldErrors, setFieldErrors] = createSignal<{
    username?: string;
    password?: string;
    name?: string;
    confirmPassword?: string;
  }>({});

  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const switchMode = (next: Mode) => {
    if (pending()) return;
    setMode(next);
    setError("");
    setFieldErrors({});
    setPassword("");
    setConfirmPassword("");
  };

  const validate = (): boolean => {
    const errors: { username?: string; password?: string; name?: string; confirmPassword?: string } = {};
    const userName = username().trim();

    if (!userName) {
      errors.username = translate(locale(), "login.errors.usernameRequired", "请输入用户名");
    } else if (/\s/.test(userName)) {
      errors.username = translate(locale(), "login.errors.usernameSpace", "用户名不能包含空格");
    }

    if (!password()) {
      errors.password = translate(locale(), "login.errors.passwordRequired", "请输入密码");
    } else if (mode() === "register" && password().length < 8) {
      errors.password = translate(locale(), "login.errors.passwordTooShort", "密码至少 8 个字符");
    }

    if (mode() === "register" && confirmPassword() !== password()) {
      errors.confirmPassword = translate(locale(), "login.register.errors.passwordMismatch", "两次输入的密码不一致");
    }

    setFieldErrors(errors);
    return !errors.username && !errors.password && !errors.confirmPassword;
  };

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    if (pending() || !validate()) return;

    setError("");
    setPending(true);

    void (async () => {
      try {
        const userName = username().trim();

        if (mode() === "register") {
          await props.onRegister({
            username: userName,
            password: password(),
            name: name().trim() || undefined,
          });
          // 注册成功后自动登录；若登录失败会停留在登录模式供用户重试。
          setMode("login");
        }

        await props.onLogin({ username: userName, password: password() });
        props.onSuccess?.();
      } catch (cause) {
        setError(cause instanceof Error && cause.message
          ? cause.message
          : translate(locale(), "login.errors.fallback", "操作失败，请稍后再试"));
      } finally {
        setPending(false);
      }
    })();
  };

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      closable={props.closable ?? false}
      closeOnOverlay={props.closable ?? false}
      overlayClass={props.overlayClass}
      locale={locale()}
      size="sm"
      header={
        <div class="grid gap-1">
          <h2 class="m-0 text-lg font-semibold text-slate-800 dark:text-slate-100">
            {mode() === "register"
              ? translate(locale(), "login.register.title", "注册账号")
              : translate(locale(), "login.dialog.title", "登录服务器")}
          </h2>
          <Show when={props.serverName?.trim()}>
            <p class="m-0 text-sm text-slate-500 dark:text-slate-400">
              {props.serverName}
            </p>
          </Show>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => switchMode(mode() === "login" ? "register" : "login")}
            disabled={pending()}
            class="mr-auto text-sm font-medium text-sky-600 outline-none transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-60 dark:text-sky-300 dark:hover:text-sky-200"
          >
            {mode() === "login"
              ? translate(locale(), "login.register.link", "没有账号？注册")
              : translate(locale(), "login.register.back", "已有账号？返回登录")}
          </button>
          <button
            type="submit"
            form="server-login-form"
            disabled={pending()}
            class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
          >
            {pending()
              ? (mode() === "register"
                ? translate(locale(), "login.register.pending", "注册中…")
                : translate(locale(), "login.pending", "登录中…"))
              : (mode() === "register"
                ? translate(locale(), "login.register.submit", "注册并登录")
                : translate(locale(), "login.submit", "登录"))}
          </button>
        </>
      }
    >
      <form
        id="server-login-form"
        class="grid gap-4"
        novalidate
        aria-busy={pending()}
        onSubmit={handleSubmit}
      >
        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "login.username", "用户名")}
          </span>
          <input
            class={inputClass}
            name="username"
            type="text"
            autocomplete="username"
            maxlength={128}
            autofocus
            disabled={pending()}
            aria-invalid={fieldErrors().username ? "true" : undefined}
            value={username()}
            onInput={(event) => {
              setUsername(event.currentTarget.value);
              setFieldErrors((current) => ({ ...current, username: undefined }));
            }}
          />
          <Show when={fieldErrors().username}>
            <span class="text-[13px] font-medium text-red-600 dark:text-red-400" role="alert">
              {fieldErrors().username}
            </span>
          </Show>
        </label>

        <Show when={mode() === "register"}>
          <label class="grid gap-2">
            <span class="text-[13px] text-slate-600 dark:text-slate-300">
              {translate(locale(), "login.register.name", "显示名称（可选）")}
            </span>
            <input
              class={inputClass}
              name="name"
              type="text"
              autocomplete="nickname"
              maxlength={256}
              disabled={pending()}
              value={name()}
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </label>
        </Show>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "login.password", "密码")}
          </span>
          <input
            class={inputClass}
            name="password"
            type="password"
            autocomplete={mode() === "register" ? "new-password" : "current-password"}
            maxlength={256}
            disabled={pending()}
            aria-invalid={fieldErrors().password ? "true" : undefined}
            value={password()}
            onInput={(event) => {
              setPassword(event.currentTarget.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
          />
          <Show when={fieldErrors().password}>
            <span class="text-[13px] font-medium text-red-600 dark:text-red-400" role="alert">
              {fieldErrors().password}
            </span>
          </Show>
        </label>

        <Show when={mode() === "register"}>
          <label class="grid gap-2">
            <span class="text-[13px] text-slate-600 dark:text-slate-300">
              {translate(locale(), "login.register.confirmPassword", "确认密码")}
            </span>
            <input
              class={inputClass}
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              maxlength={256}
              disabled={pending()}
              aria-invalid={fieldErrors().confirmPassword ? "true" : undefined}
              value={confirmPassword()}
              onInput={(event) => {
                setConfirmPassword(event.currentTarget.value);
                setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
              }}
            />
            <Show when={fieldErrors().confirmPassword}>
              <span class="text-[13px] font-medium text-red-600 dark:text-red-400" role="alert">
                {fieldErrors().confirmPassword}
              </span>
            </Show>
          </label>
        </Show>

        <Show when={error()}>
          <p
            class="m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400"
            role="alert"
          >
            {error()}
          </p>
        </Show>
      </form>
    </Dialog>
  );
};
