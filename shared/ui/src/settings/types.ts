/** 设置面板的公共类型。 */

export interface SettingsValues {
  /** 服务名称，便于区分多个服务器。 */
  name: string;
  serverUrl: string;
  token: string;
}

/** 已配置的服务器。 */
export interface ConfiguredServer {
  /** 服务名称。 */
  name?: string;
  serverUrl: string;
  /** token 不用于展示，仅保留结构便于回填。 */
  token?: string;
}

/** 设置分组标识。 */
export type SettingsSectionKey = "server" | "provider" | "account";

/** 服务器连接页面的配置（挂在 SettingsPage.server 下）。 */
export interface SettingsServerOptions {
  /** 添加服务器表单的初始值。 */
  initialValue?: SettingsValues;
  /** 已配置的服务器列表。 */
  servers?: ConfiguredServer[];
  /** 点击已配置服务器。 */
  onSelectServer?: (serverUrl: string) => void;
  /** 点击已配置服务器的「测试连接」。 */
  onTestServer?: (server: ConfiguredServer) => void;
  /** 添加服务器。 */
  onAdd?: (values: SettingsValues) => Promise<void>;
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
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** 已配置的模型供应商。 */
export interface ConfiguredModelProvider {
  name: string;
  baseUrl: string;
  model?: string;
}

/** 模型供应商页面的配置（挂在 SettingsPage.provider 下）。 */
export interface SettingsProviderOptions {
  /** 添加供应商表单的初始值。 */
  initialValue?: ModelProviderValues;
  /** 已配置的供应商列表。 */
  providers?: ConfiguredModelProvider[];
  /** 添加模型供应商。 */
  onAdd?: (values: ModelProviderValues) => Promise<void>;
}
