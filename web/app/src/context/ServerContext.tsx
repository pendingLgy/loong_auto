import {type Accessor, createMemo, createSignal, onSettled, Show,} from "solid-js";
import {type ApiConfig, DEFAULT_API_CONFIG} from "../runtime/http";

import {createWrappedApiClient} from "../runtime/http_client_wrap";

import {useLocaleContext} from "./LocaleContext";

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
    const [baseConfig, setBaseConfig] = createSignal<Partial<ApiConfig>>({});

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
        onSessionExpired: () => {
          // 可在此触发跳转登录页或清理会话状态
        },
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
