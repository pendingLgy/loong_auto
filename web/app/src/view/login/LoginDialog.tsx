import {createSignal, Show} from "solid-js";
import {Dialog} from "@kobalte/core/dialog";

import {useLocaleContext} from "../../context/LocaleContext";
import {useServerContext} from "../../context/ServerContext";
import {type LoginResponse} from "@loong/web-api";
import {AuthSession, readAuthSession, saveAuthSession} from "../../store/auth";
import {toErrorMessage} from "../../runtime/http_client_wrap";

type LoginSessionInput = Omit<AuthSession, "user_token">;

interface LoginFieldErrors {
  username?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
}


function toSession(response: LoginResponse): LoginSessionInput {
  const data = response as unknown as Record<string, unknown>;
  const rawUser = (data.user ?? data.user_info) as Record<string, unknown> | undefined;
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  if (typeof accessToken !== "string" || !accessToken
    || typeof refreshToken !== "string" || !refreshToken) {
    throw new Error("登录响应缺少令牌");
  }
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: typeof data.tokenType === "string"
      ? data.tokenType
      : typeof data.token_type === "string" ? data.token_type : "bearer",
    expires_in: typeof data.expiresIn === "number"
      ? data.expiresIn
      : typeof data.expires_in === "number" ? data.expires_in : 0,
    user: {
      id: typeof rawUser?.id === "string" ? rawUser.id : String(rawUser?.id ?? ""),
      tenant_id: typeof rawUser?.tenantId === "string"
        ? rawUser.tenantId
        : typeof rawUser?.tenant_id === "string" ? rawUser.tenant_id : "",
      username: typeof rawUser?.username === "string" ? rawUser.username : "",
      name: typeof rawUser?.name === "string" ? rawUser.name : null,
      role: typeof rawUser?.role === "string" ? rawUser.role : null,
    },
  };
}


export interface LoginDialogProps {
  onComplete: (session: LoginSessionInput) => Promise<void>;
}

/** 未登录时的登录 / 注册弹窗。 */
export function LoginDialog(props:LoginDialogProps) {
  const {locale, t} = useLocaleContext();
  const {api_client_proxy} = useServerContext();
  const [mode, setMode] = createSignal<"login" | "register">("login");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [name, setName] = createSignal("");
  const [localError, setLocalError] = createSignal<string | null>(null);
  const [fieldErrors, setFieldErrors] = createSignal<LoginFieldErrors>({});
  const [loading, setLoading] = createSignal(false);

  const client = () => api_client_proxy();

  const switchMode = (next: "login" | "register") => {
    if (next === "register") {
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setName("");
    }
    setMode(next);
    setLocalError(null);
    setFieldErrors({});
  };

  const updateUsername = (value: string) => {
    setUsername(value);
    if (fieldErrors().username) {
      setFieldErrors((current) => ({...current, username: undefined}));
    }
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    if (fieldErrors().password) {
      setFieldErrors((current) => ({...current, password: undefined}));
    }
  };

  const updateConfirmPassword = (value: string) => {
    setConfirmPassword(value);
    if (fieldErrors().confirmPassword) {
      setFieldErrors((current) => ({...current, confirmPassword: undefined}));
    }
  };

  const updateName = (value: string) => {
    setName(value);
    if (fieldErrors().name) {
      setFieldErrors((current) => ({...current, name: undefined}));
    }
  };

  const validate = (): boolean => {
    const errors: LoginFieldErrors = {};
    if (!username().trim()) {
      errors.username = t("login.usernameRequired", "请输入用户名");
    }
    if (!password()) {
      errors.password = t("login.passwordRequired", "请输入密码");
    } else if (password().length < 8) {
      errors.password = t("login.passwordMin", "密码不能少于 8 位");
    }
    if (mode() === "register") {
      if (!name().trim()) {
        errors.name = t("login.nicknameRequired", "请输入昵称");
      } else if (name().trim().length > 30) {
        errors.name = t("login.nicknameMax", "昵称不能超过 30 个字符");
      }
      if (!confirmPassword()) {
        errors.confirmPassword = t("login.confirmRequired", "请再次输入密码");
      } else if (password() !== confirmPassword()) {
        errors.confirmPassword = t("login.passwordMismatch", "两次输入的密码不一致");
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const do_login = async (): Promise<boolean> => {
    try {
      const response = await client().auth.login({
        username: username().trim(),
        password: password(),
        platform: "web",
      });

      await props.onComplete(toSession(response));

      return true;

    } catch (reason) {
      setLocalError(toErrorMessage(reason))
      return false;
    } finally {

    }
  };

  const register = async (): Promise<boolean> => {
    try {
      await client().auth.register({
        username: username().trim(),
        password: password(),
        name: name().trim(),
      });
    } catch (reason) {
      setLocalError(toErrorMessage(reason));
      return false;
    }
    return do_login();
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      if (mode() === "login") {
        await do_login();
      } else {
        await register();
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-10 rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition focus:ring-2 dark:bg-slate-950 dark:text-slate-100";

  const fieldClass = (invalid: boolean) => `${inputClass} ${
    invalid
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500"
      : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-slate-700"
  }`;

  return (
    <Dialog open modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm"/>
        <Dialog.Content
          class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <header class="border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <Dialog.Title class="m-0 text-base font-semibold">
              {mode() === "login"
                ? t("login.title", "登录")
                : t("login.registerTitle", "创建账户")}
            </Dialog.Title>
            <Dialog.Description class="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              {mode() === "login"
                ? t("login.description", "登录后继续使用。")
                : t("login.registerDescription", "注册后将自动登录。")}
            </Dialog.Description>
          </header>

          <form class="grid gap-2.5 p-3" onSubmit={submit} novalidate>
            <label class="grid gap-0.5">
              <span class="flex items-center gap-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {t("login.username", "用户名")}
                <span class="text-red-500" aria-hidden="true">*</span>
              </span>
              <input
                value={username()}
                onInput={(event) => updateUsername(event.currentTarget.value)}
                autocomplete="username"
                placeholder={t("login.usernamePlaceholder", "请输入用户名")}
                aria-required="true"
                aria-invalid={fieldErrors().username ? "true" : "false"}
                aria-describedby={fieldErrors().username ? "login-username-error" : undefined}
                class={fieldClass(Boolean(fieldErrors().username))}
              />
              <div class="min-h-4">
                <Show when={fieldErrors().username}>
                  <p id="login-username-error" role="alert" class="m-0 text-[12px] text-red-600 dark:text-red-400">
                    {fieldErrors().username}
                  </p>
                </Show>
              </div>
            </label>

            <Show when={mode() === "register"}>
              <label class="grid gap-0.5">
                <span class="flex items-center gap-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                  {t("login.nickname", "昵称")}
                  <span class="text-red-500" aria-hidden="true">*</span>
                </span>
                <input
                  value={name()}
                  onInput={(event) => updateName(event.currentTarget.value)}
                  autocomplete="nickname"
                  placeholder={t("login.nicknamePlaceholder", "请输入昵称")}
                  aria-required="true"
                  maxlength={30}
                  aria-invalid={fieldErrors().name ? "true" : "false"}
                  aria-describedby={fieldErrors().name ? "login-name-error" : undefined}
                  class={fieldClass(Boolean(fieldErrors().name))}
                />
                <div class="min-h-4">
                  <Show when={fieldErrors().name}>
                    <p id="login-name-error" role="alert" class="m-0 text-[12px] text-red-600 dark:text-red-400">
                      {fieldErrors().name}
                    </p>
                  </Show>
                </div>
              </label>
            </Show>

            <label class="grid gap-0.5">
              <span class="flex items-center gap-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {t("login.password", "密码")}
                <span class="text-red-500" aria-hidden="true">*</span>
              </span>
              <input
                value={password()}
                onInput={(event) => updatePassword(event.currentTarget.value)}
                type="password"
                autocomplete={mode() === "login" ? "current-password" : "new-password"}
                placeholder={t("login.passwordPlaceholder", "请输入密码")}
                aria-required="true"
                minlength={8}
                aria-invalid={fieldErrors().password ? "true" : "false"}
                aria-describedby={fieldErrors().password ? "login-password-error" : undefined}
                class={fieldClass(Boolean(fieldErrors().password))}
              />
              <div class="min-h-4">
                <Show when={fieldErrors().password}>
                  <p id="login-password-error" role="alert" class="m-0 text-[12px] text-red-600 dark:text-red-400">
                    {fieldErrors().password}
                  </p>
                </Show>
              </div>
            </label>

            <Show when={mode() === "register"}>
              <label class="grid gap-0.5">
                <span class="flex items-center gap-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                  {t("login.confirmPassword", "确认密码")}
                  <span class="text-red-500" aria-hidden="true">*</span>
                </span>
                <input
                  value={confirmPassword()}
                  onInput={(event) => updateConfirmPassword(event.currentTarget.value)}
                  type="password"
                  autocomplete="new-password"
                  placeholder={t("login.confirmPasswordPlaceholder", "请再次输入密码")}
                  aria-required="true"
                  aria-invalid={fieldErrors().confirmPassword ? "true" : "false"}
                  aria-describedby={fieldErrors().confirmPassword ? "login-confirm-password-error" : undefined}
                  class={fieldClass(Boolean(fieldErrors().confirmPassword))}
                />
                <div class="min-h-4">
                  <Show when={fieldErrors().confirmPassword}>
                    <p id="login-confirm-password-error" role="alert" class="m-0 text-[12px] text-red-600 dark:text-red-400">
                      {fieldErrors().confirmPassword}
                    </p>
                  </Show>
                </div>
              </label>
            </Show>

            <div class="min-h-4">
              <Show when={localError()}>
                <p role="alert" class="m-0 text-[13px] font-medium text-red-600 dark:text-red-400">
                  {localError()}
                </p>
              </Show>
            </div>

            <button
              type="submit"
              disabled={loading()}
              class="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-500 px-4 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading()
                ? t("login.loading", "处理中…")
                : mode() === "login"
                  ? t("login.submit", "登录")
                  : t("login.registerSubmit", "注册并登录")}
            </button>

            <button
              type="button"
              onClick={() => switchMode(mode() === "login" ? "register" : "login")}
              class="text-center text-[12px] text-slate-500 outline-none transition hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:text-indigo-300"
            >
              {mode() === "login"
                ? t("login.switchRegister", "没有账户？注册")
                : t("login.switchLogin", "已有账户？登录")}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
