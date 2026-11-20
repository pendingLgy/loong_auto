/** 设置面板的公共类型。 */

export interface SettingsValues {
  /** 服务名称，便于区分多个服务器。 */
  name: string;
  serverUrl: string;
  token: string;
}

/** 已配置的服务器。 */
export interface ConfiguredServer {
  /** 服务器配置 id。 */
  id?: string;
  /** 服务名称。 */
  name?: string;
  serverUrl: string;
  /** token 不用于展示，仅保留结构便于回填。 */
  token?: string;
}

/** 设置分组标识。 */
export type SettingsSectionKey = "server" | "provider" | "model" | "account";

/** 服务器连接页面的配置（挂在 SettingsPage.server 下）。 */
export interface SettingsServerOptions {
  /** 当前服务器配置。 */
  server?: ConfiguredServer;
  /** 点击已配置服务器。 */
  onSelectServer?: (serverUrl: string) => void;
  /** 点击已配置服务器的「测试连接」。 */
  onTestServer?: (server: ConfiguredServer) => void;
}

/** 账号页面的配置（挂在 SettingsPage.account 下）。 */
export interface SettingsAccountOptions {
  /** 当前账号显示名称。 */
  userName?: string;
  /** 当前账号用户名 / 邮箱。 */
  username?: string;
  /** 退出登录。 */
  onLogout?: () => void;
}

/** 模型供应商表单值。 */
export interface ModelProviderValues {
  name: string;
  /** 用户自定义的别称；为空时使用 name。 */
  alias: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** 已配置的模型供应商。 */
export interface ConfiguredModelProvider {
  name: string;
  /** 用户自定义别称；展示时优先使用。 */
  alias?: string;
  baseUrl: string;
}

/** 热门供应商推荐。 */
export interface PopularProvider {
  name: string;
  description: string;
  baseUrl: string;
}

/** 模型供应商页面的配置（挂在 SettingsPage.provider 下）。 */
export interface SettingsProviderOptions {
  /** 已配置的供应商列表。 */
  providers?: ConfiguredModelProvider[];
  /** 热门供应商卡片的数据。 */
  popular?: PopularProvider[];
  /** 「全部供应商」弹窗的数据（与热门列表独立）。 */
  allProviders?: PopularProvider[];
  /** 点击已配置供应商的「编辑」。 */
  onEditProvider?: (provider: ConfiguredModelProvider) => void;
  /** 在重命名弹窗中保存别称。 */
  onRenameProvider?: (provider: ConfiguredModelProvider, alias: string) => Promise<void>;
  /** 点击已配置供应商的「移除」。 */
  onDeleteProvider?: (provider: ConfiguredModelProvider) => void;
  /** 在编辑弹窗中保存新的 API Key。 */
  onUpdateApiKey?: (provider: ConfiguredModelProvider, apiKey: string) => Promise<void>;
  /** 点击热门供应商。 */
  onSelectPopular?: (provider: PopularProvider) => void;
  /** 点击「全部供应商」弹窗中的供应商。 */
  onSelectAllProvider?: (provider: PopularProvider) => void;
  /** 添加模型供应商。 */
  onAdd?: (values: ModelProviderValues) => Promise<void>;
}

/** 供应商提供的模型。 */
export interface ModelInfo {
  /** 模型标识，例如 gpt-4o。 */
  id: string;
  /** 显示名称；默认使用 id。 */
  name?: string;
  /** 是否已启动。 */
  enabled?: boolean;
}

/** 已配置供应商及其提供的全部模型。 */
export interface ProviderModelGroup {
  /** 供应商名称。 */
  providerName: string;
  /** 用户自定义别称；展示时优先使用。 */
  alias?: string;
  /** 供应商接口地址。 */
  baseUrl: string;
  /** 供应商提供的全部模型。 */
  models: ModelInfo[];
}

/** 模型页面的配置（挂在 SettingsPage.model 下）。 */
export interface SettingsModelOptions {
  /** 已配置的供应商及其模型列表。 */
  providers?: ProviderModelGroup[];
  /** 保存供应商下模型的启用状态。 */
  onSaveModels?: (provider: ProviderModelGroup, models: ModelInfo[]) => Promise<void>;
}
