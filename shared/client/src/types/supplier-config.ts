/** 供应商配置与模型启用配置类型。 */

export interface SupplierConfig {
  id: string;
  provider: string;
  alias: string | null;
  popular: boolean;
  description: string;
  baseUrl: string | null;
  configFlag: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SupplierModelOption {
  id: string;
  provider: string;
  model: string;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SupplierConfigSaveRequest {
  provider: string;
  apiKey: string;
  baseUrl?: string;
}

export interface SupplierModelItem {
  model: string;
  enabled: boolean;
  reasoningEffort: string[];
}

export interface SupplierProviderModels {
  provider: string;
  alias: string | null;
  baseUrl: string | null;
  models: SupplierModelItem[];
}

export interface RawSupplierProviderModelsPayload {
  provider?: unknown;
  alias?: unknown;
  base_url?: unknown;
  models?: unknown;
}

export interface RawSupplierModelItemPayload {
  model?: unknown;
  enabled?: unknown;
  reasoning_effort?: unknown;
}

export interface SupplierModelOptionSaveRequest {
  provider: string;
  model: string;
  enabled: boolean;
}

/** 云端/local 原始供应商配置字段。 */
export interface RawSupplierConfigPayload {
  id?: unknown;
  provider?: unknown;
  alias?: unknown;
  base_url?: unknown;
  popular?: boolean | null;
  description?: unknown;
  config_flag?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

/** 原始模型启用配置字段。 */
export interface RawSupplierModelOptionPayload {
  id?: unknown;
  provider?: unknown;
  model?: unknown;
  enabled?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}
