import { Show, createSignal, type Component, type JSX } from "solid-js";

import { Effect } from "effect";

import { assertLocalGateway, createLocalClient } from "@loong/client";
import { Dialog } from "@loong/ui/dialog";
import { DEFAULT_LOCALE } from "@loong/ui/i18n";

import { saveServerConfig } from "../../storage/server_config";

export interface AddServerDialogProps {
  /** 关闭弹窗。 */
  onClose: () => void;
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 aria-invalid:border-red-500 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-500/30 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** 在 HomeTabsView 中添加服务器配置的弹窗。 */
export const AddServerDialog: Component<AddServerDialogProps> = (props) => {
  const [name, setName] = createSignal("");
  const [serverUrl, setServerUrl] = createSignal("");
  const [token, setToken] = createSignal("");
  const [errors, setErrors] = createSignal<{ name?: string; serverUrl?: string; token?: string }>({});
  const [formError, setFormError] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const close = () => {
    if (saving()) return;
    props.onClose();
  };

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    if (saving()) return;

    const values = {
      name: name().trim(),
      serverUrl: serverUrl().trim(),
      token: token(),
    };

    const nextErrors: { name?: string; serverUrl?: string; token?: string } = {};
    if (!values.name) nextErrors.name = "请输入服务器名称";
    if (!values.serverUrl) {
      nextErrors.serverUrl = "请输入服务器地址";
    } else if (!isHttpUrl(values.serverUrl)) {
      nextErrors.serverUrl = "服务器地址必须是 http/https URL";
    }
    if (!values.token) nextErrors.token = "请输入 Token";

    if (nextErrors.name || nextErrors.serverUrl || nextErrors.token) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setFormError("");
    setSaving(true);

    void (async () => {
      try {
        assertLocalGateway(values.serverUrl, DEFAULT_LOCALE);
        const client = createLocalClient({
          origin: values.serverUrl,
          locale: DEFAULT_LOCALE,
          security_token: values.token,
        });
        await Effect.runPromise(client.health.security_token());

        saveServerConfig({
          name: values.name,
          serverUrl: values.serverUrl,
          token: values.token,
          connected: true,
          checkedAt: new Date().toISOString(),
        });
        props.onClose();
      } catch (cause) {
        setFormError(cause instanceof Error && cause.message
          ? cause.message
          : "保存失败，请稍后再试");
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Dialog
      open
      onClose={close}
      size="md"
      header={
        <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
          添加服务器
        </h2>
      }
      footer={
        <>
          <button
            type="button"
            onClick={close}
            disabled={saving()}
            class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
          >
            取消
          </button>
          <button
            type="submit"
            form="add-server-form"
            disabled={saving()}
            class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
          >
            {saving() ? "保存中…" : "添加"}
          </button>
        </>
      }
    >
      <form
        id="add-server-form"
        class="grid gap-4"
        novalidate
        aria-busy={saving()}
        onSubmit={handleSubmit}
      >
        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">服务器名称</span>
          <input
            class={inputClass}
            name="name"
            type="text"
            autocomplete="off"
            spellcheck={false}
            placeholder="例如：本地开发"
            disabled={saving()}
            aria-invalid={errors().name ? "true" : undefined}
            value={name()}
            onInput={(event) => {
              setName(event.currentTarget.value);
              setErrors((current) => ({ ...current, name: undefined }));
            }}
          />
          <ShowError message={errors().name} />
        </label>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">服务器地址</span>
          <input
            class={inputClass}
            name="serverUrl"
            type="url"
            inputmode="url"
            autocomplete="url"
            spellcheck={false}
            placeholder="http://127.0.0.1:9528"
            disabled={saving()}
            aria-invalid={errors().serverUrl ? "true" : undefined}
            value={serverUrl()}
            onInput={(event) => {
              setServerUrl(event.currentTarget.value);
              setErrors((current) => ({ ...current, serverUrl: undefined }));
            }}
          />
          <ShowError message={errors().serverUrl} />
        </label>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">Token</span>
          <input
            class={inputClass}
            name="token"
            type="password"
            autocomplete="off"
            spellcheck={false}
            placeholder="粘贴访问 Token"
            disabled={saving()}
            aria-invalid={errors().token ? "true" : undefined}
            value={token()}
            onInput={(event) => {
              setToken(event.currentTarget.value);
              setErrors((current) => ({ ...current, token: undefined }));
            }}
          />
          <ShowError message={errors().token} />
        </label>

        <ShowError message={formError()} block />
      </form>
    </Dialog>
  );
};

function ShowError(props: { message?: string; block?: boolean }) {
  return (
    <Show when={props.message}>
      <p
        class={props.block
          ? "m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400"
          : "m-0 text-[13px] font-medium text-red-600 dark:text-red-400"}
        role="alert"
      >
        {props.message}
      </p>
    </Show>
  );
}
