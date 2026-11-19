import { createSignal, onCleanup, Show, type Component, type JSX } from "solid-js";

import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

export interface ServerConfigValues {
  serverUrl: string;
  token: string;
}

export interface ServerConfigPageProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 初始值，用于编辑已有配置。 */
  initialValue?: ServerConfigValues;
  /** 额外的业务校验；返回文案表示不通过。 */
  validate?: (values: ServerConfigValues) => string | undefined;
  /** 保存配置；抛出的 Error.message 会展示在表单里。 */
  onSubmit: (values: ServerConfigValues) => Promise<void>;
  onSuccess?: () => void;
  disabled?: boolean;
  autofocus?: boolean;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 服务器配置表单：服务器地址 + Token。
 *
 * 只负责输入、校验展示与保存回调，不读取或持久化配置；可见文案通过
 * `translate(locale, key, fallback)` 获取，具体保存逻辑由 `onSubmit` 注入。
 */
export const ServerConfigPage: Component<ServerConfigPageProps> = (props) => {
  const [serverUrl, setServerUrl] = createSignal(props.initialValue?.serverUrl ?? "");
  const [token, setToken] = createSignal(props.initialValue?.token ?? "");
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

    const values: ServerConfigValues = {
      serverUrl: serverUrl().trim(),
      token: token(),
    };

    if (!values.serverUrl) {
      setError(translate(locale(), "serverConfig.errors.serverUrlRequired", "请输入服务器地址"));
      return;
    }
    if (!isHttpUrl(values.serverUrl)) {
      setError(translate(locale(), "serverConfig.errors.serverUrlInvalid",
        "服务器地址必须是 http/https URL"));
      return;
    }
    if (!values.token) {
      setError(translate(locale(), "serverConfig.errors.tokenRequired", "请输入 Token"));
      return;
    }
    const validationError = props.validate?.(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setPending(true);

    void props.onSubmit(values)
      .then(() => {
        if (disposed) return;
        setPending(false);
        props.onSuccess?.();
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        setPending(false);
        setError(cause instanceof Error && cause.message
          ? cause.message
          : translate(locale(), "serverConfig.errors.fallback", "保存失败，请稍后再试"));
      });
  };

  return (
    <main class="grid min-h-screen place-items-center bg-linear-to-br from-sky-50 via-white to-slate-100 p-6 text-slate-900 dark:from-slate-900 dark:via-slate-950 dark:to-black dark:text-slate-100">
      <form
        class="grid w-full max-w-sm gap-[18px] rounded-2xl border border-slate-200 bg-white/90 p-7 shadow-2xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/50"
        onSubmit={handleSubmit}
        aria-label={translate(locale(), "serverConfig.title", "配置服务器")}
        aria-busy={pending()}
      >
        <header>
          <h1 class="m-0 text-2xl tracking-tight">
            {translate(locale(), "serverConfig.title", "配置服务器")}
          </h1>
          <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {translate(locale(), "serverConfig.description", "填写本地网关地址与访问 Token")}
          </p>
        </header>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "serverConfig.serverUrl", "服务器地址")}
          </span>
          <input
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100"
            name="serverUrl"
            type="url"
            inputmode="url"
            autocomplete="url"
            spellcheck={false}
            placeholder={translate(locale(), "serverConfig.serverUrlPlaceholder",
              "http://127.0.0.1:9528")}
            required
            autofocus={props.autofocus}
            disabled={pending() || props.disabled}
            value={serverUrl()}
            onInput={(event) => setServerUrl(event.currentTarget.value)}
          />
        </label>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "serverConfig.token", "Token")}
          </span>
          <input
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100"
            name="token"
            type="password"
            autocomplete="off"
            spellcheck={false}
            placeholder={translate(locale(), "serverConfig.tokenPlaceholder", "粘贴访问 Token")}
            required
            disabled={pending() || props.disabled}
            value={token()}
            onInput={(event) => setToken(event.currentTarget.value)}
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
            ? translate(locale(), "serverConfig.saving", "保存中…")
            : translate(locale(), "serverConfig.submit", "保存配置")}
        </button>
      </form>
    </main>
  );
};
