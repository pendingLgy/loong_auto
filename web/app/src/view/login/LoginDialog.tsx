import { Show, createSignal } from "solid-js";
import { Dialog } from "@kobalte/core/dialog";

import { useLocaleContext } from "../../context/LocaleContext";
import { useServerContext } from "../../context/ServerContext";
import { type LoginResponse } from "@loong/web-api";
import { HttpRequestError, api_client } from "../../runtime/http";
import type { AuthSession } from "../../store/auth";

 type LoginSessionInput = Omit<AuthSession, "user_token">;

export interface LoginDialogProps {
  loading: boolean;
  error: string | null;
  onComplete: (session: LoginSessionInput) => Promise<void>;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string | null) => void;
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

function errorMessage(error: unknown): string {
  return error instanceof HttpRequestError
    ? error.message
    : error instanceof Error ? error.message : String(error);
}

/** 未登录时的登录 / 注册弹窗。 */
export function LoginDialog(props: LoginDialogProps) {
  const {locale, t} = useLocaleContext();
  const {serverUrl, securityToken} = useServerContext();
  const [mode, setMode] = createSignal<"login" | "register">("login");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [name, setName] = createSignal("");
  const [localError, setLocalError] = createSignal<string | null>(null);

  const client = () => api_client({
    baseUrl: serverUrl(),
    securityToken: securityToken(),
    locale: locale(),
    translate: t,
  });

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setLocalError(null);
    props.onError(null);
  };

  const login = async (): Promise<boolean> => {
    props.onLoadingChange(true);
    props.onError(null);
    try {
      const response = await client().auth.login({
        username: username().trim(),
        password: password(),
        platform: "web",
      });
      await props.onComplete(toSession(response));
      return true;
    } catch (reason) {
      props.onError(errorMessage(reason));
      return false;
    } finally {
      props.onLoadingChange(false);
    }
  };

  const register = async (): Promise<boolean> => {
    props.onLoadingChange(true);
    props.onError(null);
    try {
      await client().auth.register({
        username: username().trim(),
        password: password(),
        name: name().trim() || undefined,
      });
    } catch (reason) {
      props.onError(errorMessage(reason));
      props.onLoadingChange(false);
      return false;
    }
    props.onLoadingChange(false);
    return login();
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (mode() === "login") {
      await login();
    } else {
      if (password() !== confirmPassword()) {
        setLocalError(t("login.passwordMismatch", "两次输入的密码不一致"));
        return;
      }
      await register();
    }
  };

  const inputClass =
    "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

  return (
    <Dialog open modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content
          class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <header class="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
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

          <form class="grid gap-4 p-5" onSubmit={submit}>
            <label class="grid gap-1.5">
              <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {t("login.username", "用户名")}
              </span>
              <input
                value={username()}
                onInput={(event) => setUsername(event.currentTarget.value)}
                autocomplete="username"
                required
                class={inputClass}
              />
            </label>

            <Show when={mode() === "register"}>
              <label class="grid gap-1.5">
                <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                  {t("login.name", "显示名称")}
                </span>
                <input
                  value={name()}
                  onInput={(event) => setName(event.currentTarget.value)}
                  autocomplete="name"
                  class={inputClass}
                />
              </label>
            </Show>

            <label class="grid gap-1.5">
              <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {t("login.password", "密码")}
              </span>
              <input
                value={password()}
                onInput={(event) => setPassword(event.currentTarget.value)}
                type="password"
                autocomplete={mode() === "login" ? "current-password" : "new-password"}
                required
                class={inputClass}
              />
            </label>

            <Show when={mode() === "register"}>
              <label class="grid gap-1.5">
                <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                  {t("login.confirmPassword", "确认密码")}
                </span>
                <input
                  value={confirmPassword()}
                  onInput={(event) => setConfirmPassword(event.currentTarget.value)}
                  type="password"
                  autocomplete="new-password"
                  required
                  class={inputClass}
                />
              </label>
            </Show>

            <Show when={localError() ?? props.error}>
              <p role="alert" class="m-0 text-[13px] font-medium text-red-600 dark:text-red-400">
                {localError() ?? props.error}
              </p>
            </Show>

            <button
              type="submit"
              disabled={props.loading}
              class="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-500 px-4 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {props.loading
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
