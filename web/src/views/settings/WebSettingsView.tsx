import { createSignal } from "solid-js";

import { useNavigate } from "@solidjs/router";

import { Effect } from "effect";

import {
  createLocalClient,
  type SupplierConfig,
  type SupplierProviderModels,
} from "@loong/client";

import { createApiClient } from "../../api";
import { DEFAULT_LOCALE } from "@loong/ui/i18n";
import {
  SettingsPage,
  type ConfiguredServer,
  type ConfiguredModelProvider,
  type ModelProviderValues,
  type ProviderModelGroup,
} from "@loong/ui/settings";

import { serverConfig, updateServerStatus } from "../../storage/server_config";
import { clearUserWebStorage} from "../../storage/reset";
import { showNotice } from "../../storage/app_notice";
import { currentUser } from "../../storage/user";

/** 设置页：`/settings` 嵌套路由，管理中栏的服务器 / 供应商 / 模型 / 账号。 */
export function WebSettingsView() {
  const navigate = useNavigate();
  const [supplierConfigs, setSupplierConfigs] = createSignal<SupplierConfig[]>([]);
  const [configuredSupplierConfigs, setConfiguredSupplierConfigs] = createSignal<SupplierConfig[]>([]);
  const [modelProviders, setModelProviders] = createSignal<ProviderModelGroup[]>([]);

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
      showNotice("error", "获取供应商列表失败");
    }
  };

  const currentServerOption = () => {
    const config = serverConfig();
    return config
      ? { id: "default", name: config.name, serverUrl: config.serverUrl, token: config.token }
      : undefined;
  };

  const serverLabel = (server: ConfiguredServer) => server.name?.trim() || server.serverUrl;

  const logout = async () => {
    try {
      // 服务端注销失败也要清除本地缓存，避免残留无效令牌。
      await Effect.runPromise(createApiClient().auth.logout());
    } catch {
      // 忽略注销请求异常。
    } finally {
      clearUserWebStorage();
      navigate("/");
    }
  };

  const modelGroups = (providers: SupplierProviderModels[]): ProviderModelGroup[] =>
    providers.map((provider) => ({
      providerName: provider.provider,
      alias: provider.alias ?? undefined,
      baseUrl: provider.baseUrl ?? "",
      models: provider.models.map((model) => ({
        id: model.model,
        enabled: model.enabled,
      })),
    }));

  const loadModelProviders = async () => {
    try {
      const providers = await Effect.runPromise(createApiClient().supplierConfig.listModels());
      setModelProviders(modelGroups(providers));
    } catch {
      setModelProviders([]);
      showNotice("error", "获取模型列表失败");
    }
  };

  const toggleModelOption = async (
    provider: ProviderModelGroup,
    model: ProviderModelGroup["models"][number],
    enabled: boolean,
  ) => {
    try {
      await Effect.runPromise(
        createApiClient().supplierConfig.saveOption({
          provider: provider.providerName,
          model: model.id,
          enabled,
        }),
      );
      await loadModelProviders();
    } catch (cause) {
      showNotice(
        "error",
        cause instanceof Error && cause.message
          ? cause.message
          : "模型启用状态保存失败",
      );
      throw cause;
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
    showNotice("success", `${values.alias.trim() || values.name} 已连接`);
  };

  const updateProviderApiKey = async (provider: ConfiguredModelProvider, apiKey: string) => {
    await Effect.runPromise(
      createApiClient().supplierConfig.updateApiKey(provider.name, apiKey),
    );
    await loadSupplierConfigs();
    showNotice("success", `${provider.alias?.trim() || provider.name} API Key 已更新`);
  };

  const renameProvider = async (provider: ConfiguredModelProvider, alias: string) => {
    await Effect.runPromise(
      createApiClient().supplierConfig.rename(provider.name, alias),
    );
    await loadSupplierConfigs();
    showNotice("success", `${alias} 已更新`);
  };

  const removeProvider = async (provider: ConfiguredModelProvider) => {
    await Effect.runPromise(createApiClient().supplierConfig.remove(provider.name));
    await loadSupplierConfigs();
    showNotice("success", `${provider.alias?.trim() || provider.name} 已移除`);
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

  const testServer = async (_server: ConfiguredServer) => {
    const config = serverConfig();
    if (!config) return;

    try {
      const client = createLocalClient({
        origin: config.serverUrl,
        locale: DEFAULT_LOCALE,
        security_token: config.token,
      });
      await Effect.runPromise(client.health.security_token());
      updateServerStatus(true);
      showNotice("success", `${serverLabel(config)} 连接正常`);
    } catch {
      updateServerStatus(false);
      showNotice("error", `${serverLabel(config)} 连接失败`);
    }
  };

  return (
    <div class="mx-auto grid w-full max-w-5xl gap-4 p-6">
      <SettingsPage
        defaultSection="server"
        onBack={() => navigate("/")}
        server={{
          server: currentServerOption(),
          onTestServer: testServer,
        }}
        onSectionChange={(key) => {
          if (key === "provider") void loadSupplierConfigs();
          if (key === "model") void loadModelProviders();
        }}
        provider={{
          ...providerOptions(),
          onAdd: saveProvider,
          onUpdateApiKey: updateProviderApiKey,
          onRenameProvider: renameProvider,
          onDeleteProvider: (provider) => void removeProvider(provider),
        }}
        model={{
          providers: modelProviders(),
          onToggleModel: toggleModelOption,
        }}
        account={{
          userName: currentUser()?.name ?? currentUser()?.username,
          username: currentUser()?.username,
          onLogout: logout,
        }}
      />


    </div>
  );
}
