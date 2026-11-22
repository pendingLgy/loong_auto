import { createSignal } from "solid-js";

import { useNavigate } from "@solidjs/router";

import { Effect } from "effect";

import { createLocalClient, type SupplierConfig } from "@loong/client";

import { createApiClient } from "../../api";
import { DEFAULT_LOCALE } from "@loong/ui/i18n";
import { Toast, type MessageType } from "@loong/ui/message";
import {
  SettingsPage,
  type ConfiguredServer,
  type ConfiguredModelProvider,
  type ModelProviderValues,
} from "@loong/ui/settings";

import {
  activeServerId,
  servers,
  setActiveServer,
  updateServerStatus,
} from "../../storage/server_config";
import { clearUser, currentUser } from "../../storage/user";

interface ToastState {
  type: MessageType;
  text: string;
}

/** 设置页：`/settings` 嵌套路由，管理中栏的服务器 / 供应商 / 模型 / 账号。 */
export function WebSettingsPage() {
  const navigate = useNavigate();
  const [toast, setToast] = createSignal<ToastState | null>(null);
  const [supplierConfigs, setSupplierConfigs] = createSignal<SupplierConfig[]>([]);
  const [configuredSupplierConfigs, setConfiguredSupplierConfigs] = createSignal<SupplierConfig[]>([]);

  const loadSupplierConfigs = async () => {
    try {
      const client = createApiClient();
      const [available, configured] = await Promise.all([
        Effect.runPromise(client.supplierConfig.list()),
        Effect.runPromise(client.supplierConfig.listConfigured()),
      ]);
      setSupplierConfigs(available);
      setConfiguredSupplierConfigs(configured);
    } catch {
      setSupplierConfigs([]);
      setConfiguredSupplierConfigs([]);
      showToast("error", "获取供应商列表失败");
    }
  };

  const currentServerOption = () => {
    const list = servers();
    const active = list.find((item) => item.id === activeServerId()) ?? list[0];
    return active
      ? { id: active.id, name: active.name, serverUrl: active.serverUrl, token: active.token }
      : undefined;
  };

  const showToast = (type: MessageType, text: string) => {
    // 先关闭再下一帧打开，确保连续测试时自动关闭计时器重新开始。
    setToast(null);
    queueMicrotask(() => setToast({ type, text }));
  };

  const serverLabel = (server: ConfiguredServer) => server.name?.trim() || server.serverUrl;

  const logout = async () => {
    try {
      // 服务端注销失败也要清除本地缓存，避免残留无效令牌。
      await Effect.runPromise(createApiClient().auth.logout());
    } catch {
      // 忽略注销请求异常。
    } finally {
      clearUser();
      navigate("/");
    }
  };

  const saveProvider = async (values: ModelProviderValues) => {
    const client = createApiClient();
    await Effect.runPromise(
      client.supplierConfig.save({
        provider: values.name,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
      }),
    );
    await loadSupplierConfigs();
    showToast("success", `${values.alias.trim() || values.name} 已连接`);
  };

  const updateProviderApiKey = async (provider: ConfiguredModelProvider, apiKey: string) => {
    await Effect.runPromise(
      createApiClient().supplierConfig.updateApiKey(provider.name, apiKey),
    );
    await loadSupplierConfigs();
    showToast("success", `${provider.alias?.trim() || provider.name} API Key 已更新`);
  };

  const renameProvider = async (provider: ConfiguredModelProvider, alias: string) => {
    await Effect.runPromise(
      createApiClient().supplierConfig.rename(provider.name, alias),
    );
    await loadSupplierConfigs();
    showToast("success", `${alias} 已更新`);
  };

  const removeProvider = async (provider: ConfiguredModelProvider) => {
    await Effect.runPromise(createApiClient().supplierConfig.remove(provider.name));
    await loadSupplierConfigs();
    showToast("success", `${provider.alias?.trim() || provider.name} 已移除`);
  };

  const providerOptions = () => {
    const configs = supplierConfigs() ?? [];
    const configured = configuredSupplierConfigs() ?? [];
    const toCard = (config: (typeof configs)[number]) => ({
      name: config.provider,
      description: config.description,
      baseUrl: config.baseUrl ?? "",
    });

    return {
      providers: configured.map((config) => ({
        name: config.provider,
        alias: config.alias ?? undefined,
        baseUrl: config.baseUrl ?? "",
      })),
      popular: configs.filter((config) => config.popular).map(toCard),
      allProviders: configs.map(toCard),
    };
  };

  const findServer = (server: ConfiguredServer) =>
    server.id
      ? servers().find((item) => item.id === server.id)
      : servers().find((item) => item.serverUrl === server.serverUrl);

  const testServer = async (server: ConfiguredServer) => {
    const config = findServer(server);
    if (!config) return;

    try {
      const client = createLocalClient({
        origin: config.serverUrl,
        locale: DEFAULT_LOCALE,
        security_token: config.token,
      });
      await Effect.runPromise(client.health.security_token());
      updateServerStatus(config.id, true);
      showToast("success", `${serverLabel(config)} 连接正常`);
    } catch {
      updateServerStatus(config.id, false);
      showToast("error", `${serverLabel(config)} 连接失败`);
    }
  };

  return (
    <div class="mx-auto grid w-full max-w-5xl gap-4 p-6">
      <SettingsPage
        defaultSection="server"
        onBack={() => navigate("/")}
        server={{
          server: currentServerOption(),
          onSelectServer: (serverUrl) => {
            const target = servers().find((server) => server.serverUrl === serverUrl);
            if (target) setActiveServer(target.id);
          },
          onTestServer: testServer,
        }}
        onSectionChange={(key) => {
          if (key === "provider") void loadSupplierConfigs();
        }}
        provider={{
          ...providerOptions(),
          onAdd: saveProvider,
          onUpdateApiKey: updateProviderApiKey,
          onRenameProvider: renameProvider,
          onDeleteProvider: (provider) => void removeProvider(provider),
        }}
        account={{
          userName: currentUser()?.name ?? currentUser()?.username,
          username: currentUser()?.username,
          onLogout: logout,
        }}
      />


      <Toast
        type={toast()?.type ?? "info"}
        open={toast() !== null}
        duration={2500}
        onClose={() => setToast(null)}
      >
        {toast()?.text}
      </Toast>
    </div>
  );
}
