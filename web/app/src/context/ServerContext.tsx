import {
  Show,
  createContext,
  createSignal,
  onSettled,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js";
import { HttpRequestError, api_client } from "../runtime/http";
import { Button } from "@kobalte/core/button";
import { Dialog } from "@kobalte/core/dialog";

import { useLocaleContext } from "./LocaleContext";

import {
  DEFAULT_SERVER_URL,
  clearServerConfig,
  readServerConfig,
  saveServerConfig,
} from "../store/server";

export interface ServerConfigDialogProps {
  initialUrl: Accessor<string>;
  initialToken: Accessor<string>;
  checking: Accessor<boolean>;
  closable: Accessor<boolean>;
  onClose: () => void;
  onTest: (url: string, token: string) => Promise<boolean>;
  onSave: (url: string, token: string) => Promise<boolean>;
}

function errorMessage(error: unknown): string {
  return error instanceof HttpRequestError
    ? error.message
    : error instanceof Error ? error.message : String(error);
}

/** 本地网关配置弹窗。 */
export function ServerConfigDialog(props: ServerConfigDialogProps) {
  const {locale, t} = useLocaleContext();
  const [url, setUrl] = createSignal(props.initialUrl());
  const [token, setToken] = createSignal(props.initialToken());
  const [error, setError] = createSignal("");
  const [message, setMessage] = createSignal("");

  const test = async () => {
    setError("");
    setMessage(t("server.config.checking", "正在检查连接…"));
    try {
      const ok = await props.onTest(url().trim(), token().trim());
      setMessage(ok
        ? t("server.config.success", "连接成功")
        : t("server.config.failed", "连接失败，请检查客户端地址或访问令牌"));
      if (!ok) setError(t("server.config.failed", "连接失败，请检查客户端地址或访问令牌"));
    } catch (reason) {
      setMessage("");
      setError(errorMessage(reason));
    }
  };

  const save = async () => {
    setError("");
    setMessage("");
    try {
      const ok = await props.onSave(url().trim(), token().trim());
      if (!ok) {
        setError(t("server.config.saveFailed", "连接失败，无法保存客户端配置"));
      }
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <Dialog
      open
      modal
      onOpenChange={(open) => {
        if (!open && props.closable() && !props.checking()) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content
          class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900"
          onPointerDownOutside={(event) => {
            if (!props.closable() || props.checking()) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (!props.closable() || props.checking()) event.preventDefault();
          }}
        >
          <header class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <Dialog.Title class="m-0 text-base font-semibold">
              {t("server.config.title", "配置客户端")}
            </Dialog.Title>
            <Show when={props.closable()}>
              <Dialog.CloseButton
                disabled={props.checking()}
                aria-label={t("server.config.close", "关闭配置")}
                title={t("server.config.close", "关闭配置")}
                class="grid h-8 w-8 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                ✕
              </Dialog.CloseButton>
            </Show>
          </header>

          <form
            class="grid gap-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label class="grid gap-1.5">
              <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {t("server.config.url", "客户端地址")}
              </span>
              <input
                value={url()}
                onInput={(event) => setUrl(event.currentTarget.value)}
                placeholder="http://127.0.0.1:9528"
                autocomplete="url"
                aria-invalid={error() ? "true" : "false"}
                class="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <label class="grid gap-1.5">
              <span class="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {t("server.config.token", "访问令牌")}
              </span>
              <input
                value={token()}
                onInput={(event) => setToken(event.currentTarget.value)}
                type="password"
                autocomplete="off"
                class="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <Show when={error()}>
              <p role="alert" class="m-0 text-[13px] font-medium text-red-600 dark:text-red-400">
                {error()}
              </p>
            </Show>
            <Show when={message()}>
              <p role="status" class="m-0 text-[13px] text-slate-500 dark:text-slate-400">
                {message()}
              </p>
            </Show>

            <div class="flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => void test()}
                disabled={props.checking()}
                class="h-9 rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700 outline-none transition hover:bg-slate-900/5 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-white/5"
              >
                {props.checking()
                  ? t("server.config.testing", "检查中…")
                  : t("server.config.test", "测试连接")}
              </Button>
              <Button
                type="submit"
                disabled={props.checking()}
                class="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-500 px-4 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("server.config.save", "保存并连接")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

interface ServerContextValue {
  serverUrl: Accessor<string>;
  securityToken: Accessor<string>;
  configured: Accessor<boolean>;
  connected: Accessor<boolean>;
  checking: Accessor<boolean>;
  dialogOpen: Accessor<boolean>;
  setDialogOpen: (open: boolean) => void;
  checkConnection: () => Promise<boolean>;
  testConnection: (url: string, token: string) => Promise<boolean>;
  saveAndConnect: (url: string, token: string) => Promise<boolean>;
  disconnectServer: () => void;
}

const ServerContext = createContext<ServerContextValue>();

/** 服务器连接上下文：启动检查、配置弹窗与测试连接。 */
export function ServerProvider(props: ParentProps) {
  const {locale, t} = useLocaleContext();
  const initial = readServerConfig();
  const [serverUrl, setServerUrl] = createSignal(initial?.url ?? DEFAULT_SERVER_URL);
  const [securityToken, setSecurityToken] = createSignal(initial?.securityToken ?? "");
  const [serverConfigured, setServerConfigured] = createSignal(initial !== null);
  const [connected, setConnected] = createSignal(false);
  const [checking, setChecking] = createSignal(false);
  const [dialogOpen, setDialogOpen] = createSignal(false);

  const testConnection = async (url: string, token: string): Promise<boolean> => {
    setChecking(true);
    try {
      await api_client({baseUrl: url, securityToken: token, locale: locale(), translate: t}).health.securityToken();
      setConnected(true);
      return true;
    } catch (error) {
      setConnected(false);
      throw error;
    } finally {
      setChecking(false);
    }
  };

  const checkConnection = async (): Promise<boolean> => {
    if (!serverConfigured()) {
      setDialogOpen(true);
      return false;
    }
    try {
      const ok = await testConnection(serverUrl(), securityToken());
      if (!ok) setDialogOpen(true);
      return ok;
    } catch {
      setDialogOpen(true);
      return false;
    }
  };

  const saveAndConnect = async (url: string, token: string): Promise<boolean> => {
    const ok = await testConnection(url, token);
    if (!ok) return false;
    const saved = saveServerConfig({url, securityToken: token});
    setServerUrl(saved.url);
    setSecurityToken(saved.securityToken);
    setServerConfigured(true);
    setDialogOpen(false);
    return true;
  };

  const disconnectServer = (): void => {
    clearServerConfig();
    setServerUrl(DEFAULT_SERVER_URL);
    setSecurityToken("");
    setServerConfigured(false);
    setConnected(false);
    setDialogOpen(true);
  };

  onSettled(() => {
    void checkConnection();
  });

  return (
    <ServerContext
      value={{
        serverUrl,
        securityToken,
        configured: serverConfigured,
        connected,
        checking,
        dialogOpen,
        setDialogOpen,
        checkConnection,
        testConnection,
        saveAndConnect,
        disconnectServer,
      }}
    >
      {props.children}
      <Show when={dialogOpen()}>
        <ServerConfigDialog
          initialUrl={serverUrl}
          initialToken={securityToken}
          checking={checking}
          closable={serverConfigured}
          onClose={() => setDialogOpen(false)}
          onTest={testConnection}
          onSave={saveAndConnect}
        />
      </Show>
    </ServerContext>
  );
}

/** 读取服务器上下文，必须在 ServerProvider 内使用。 */
export function useServerContext(): ServerContextValue {
  return useContext(ServerContext);
}
