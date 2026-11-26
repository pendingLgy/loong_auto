/** 供应商配置与模型启用配置类型。 */

export interface SupplierConfigResponse {
  id: string;
  provider: string;
  alias: string | null;
  popular: boolean;
  description: string;
  base_url: string | null;
  config_flag: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface SupplierModelOptionResponse {
  id: string;
  provider: string;
  model: string;
  enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface SupplierConfigSaveRequest {
  provider: string;
  api_key: string;
  base_url?: string;
}

export interface SupplierConfigDeleteRequest {
  provider: string;
}

export interface SupplierConfigApiKeyRequest {
  provider: string;
  api_key: string;
}

export interface SupplierConfigRenameRequest {
  provider: string;
  alias: string;
}

export interface SupplierModelItemResponse {
  model: string;
  enabled: boolean;
  reasoning_effort: string[];
}

export interface SupplierProviderModelsResponse {
  provider: string;
  alias: string | null;
  base_url: string | null;
  models: SupplierModelItemResponse[];
}

export interface RawSupplierProviderModelsResponse {
  provider?: unknown;
  alias?: unknown;
  base_url?: unknown;
  models?: unknown;
}

export interface RawSupplierModelItemResponse {
  model?: unknown;
  enabled?: unknown;
  reasoning_effort?: unknown;
}

export interface SupplierModelOptionSaveRequest {
  provider: string;
  model: string;
  enabled: boolean;
}

export interface SupplierModelOptionDeleteRequest {
  provider: string;
  model: string;
}

export interface SupplierConfigOptionsRequest {
  provider?: string;
}

/** 云端/local 原始供应商配置字段。 */
export interface RawSupplierConfigResponse {
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
export interface RawSupplierModelOptionResponse {
  id?: unknown;
  provider?: unknown;
  model?: unknown;
  enabled?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}
