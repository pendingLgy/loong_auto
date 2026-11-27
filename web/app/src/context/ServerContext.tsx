import {type Accessor, createMemo, createSignal, onCleanup, onSettled, Show,} from "solid-js";
import {Dialog} from "@kobalte/core/dialog";
import {type ApiConfig, DEFAULT_API_CONFIG} from "../runtime/http";

import {createWrappedApiClient} from "../runtime/http_client_wrap";

import {useLocaleContext} from "./LocaleContext";
import {clearAuthSession} from "../store/auth";

import {
  clearServerConfig,
  DEFAULT_SERVER_URL,
  readServerConfig,
  saveServerConfig,
} from "../store/server";
import {createSimpleContext} from "./ContextHelper";
import {ServerConfigDialog} from "../view/server/ServerConfigDialog";


export interface ServerContextValue {
  ready: Accessor<boolean>;
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
  sessionExpired: Accessor<boolean>;
  api_client_proxy: Accessor<ReturnType<typeof createWrappedApiClient>>;
}

const serverCtx = createSimpleContext<ServerContextValue>({
  name: "ServerContext",
  gate: true,
  init: () => {
    const {locale, t} = useLocaleContext();
    const initial = readServerConfig();

    const [ready, setReady] = createSignal(false);
    const [serverUrl, setServerUrl] = createSignal(initial?.url ?? DEFAULT_SERVER_URL);
    const [securityToken, setSecurityToken] = createSignal(initial?.security_token ?? "");
    const [serverConfigured, setServerConfigured] = createSignal(initial !== null);
    const [connected, setConnected] = createSignal(false);
    const [checking, setChecking] = createSignal(false);
    const [dialogOpen, setDialogOpen] = createSignal(false);
    const [sessionExpired, setSessionExpired] = createSignal(false);
    const [baseConfig, setBaseConfig] = createSignal<Partial<ApiConfig>>({});

    const handleSessionExpired = () => {
      if (sessionExpired()) return;
      clearAuthSession();
      setSessionExpired(true);
    };

    const apiConfig = createMemo<ApiConfig>(() => ({
      ...DEFAULT_API_CONFIG,
      ...baseConfig(),
      locale: locale(),
      translate: t,
    }));

    const api_client_proxy = createMemo(() =>
      createWrappedApiClient({
        override: apiConfig(),
        onError: (_msg) => {
        },
        onSessionExpired: handleSessionExpired,
      }),
    );

    const testConnection = async (url: string, token: string): Promise<boolean> => {
      const prevConfig = baseConfig();
      setChecking(true);
      await setBaseConfig({
        ...prevConfig,
        baseUrl: url,
        securityToken: token,
        locale: locale(),
        translate: t,
      });

      try {
        await api_client_proxy().health.securityToken();
        setConnected(true);
        return true;
      } catch (error) {
        setConnected(false);
        setBaseConfig(prevConfig);
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
      const saved = saveServerConfig({url, security_token: token});
      setServerUrl(saved.url);
      setSecurityToken(saved.security_token);
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
      setBaseConfig({locale: locale(), translate: t});
      setDialogOpen(true);
    };

    onSettled(() => {
      void checkConnection().finally(() => {
        setReady(true);
      });
    });

    return {
      ready,
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
      sessionExpired,
      api_client_proxy,
    };
  },
});

export const useServerContext = serverCtx.use
export const ServerProvider = serverCtx.provider

export function ServerConfigModal() {
  const server = useServerContext();

  return (
    <Show when={server.dialogOpen()}>
      <ServerConfigDialog
        checking={server.checking}
        closable={server.configured}
        onClose={() => server.setDialogOpen(false)}
        onTest={server.testConnection}
        onSave={server.saveAndConnect}
      />
    </Show>
  );
}


/** 登录过期提示弹窗：倒计时结束后刷新页面。 */
export function SessionExpiredModal() {
  const server = useServerContext();

  return (
    <Show when={server.sessionExpired()}>
      <SessionExpiredDialog />
    </Show>
  );
}

function SessionExpiredDialog() {
  const {t} = useLocaleContext();
  const [seconds, setSeconds] = createSignal(3);

  const timer = window.setInterval(() => {
    setSeconds((current) => {
      if (current <= 1) {
        window.clearInterval(timer);
        window.location.reload();
        return 0;
      }
      return current - 1;
    });
  }, 1000);
  onCleanup(() => window.clearInterval(timer));

  return (
    <Dialog open modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[90] bg-slate-950/50 backdrop-blur-sm" />
        <Dialog.Content
          class="fixed left-1/2 top-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <Dialog.Title class="m-0 text-base font-semibold">
            {t("login.expiredTitle", "登录已过期")}
          </Dialog.Title>
          <Dialog.Description class="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("login.expired", "登录过期，请重新登录。")}
          </Dialog.Description>
          <p class="mt-4 text-[13px] font-medium text-slate-600 dark:text-slate-300">
            {t("login.expiredReload", "{seconds} 秒后刷新页面", {seconds: seconds()})}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
