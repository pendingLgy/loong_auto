import { defineEndpoint } from "../core";
import type {
  SupplierConfig,
  SupplierConfigSaveRequest,
  SupplierModelOption,
  SupplierModelOptionSaveRequest,
  SupplierProviderModels,
} from "../types";

export const SUPPLIER_CONFIG_ENDPOINTS = {
  list: defineEndpoint<void, SupplierConfig[]>(
    "GET",
    "/api/supplier-configs",
  ),
  listConfigured: defineEndpoint<void, SupplierConfig[]>(
    "GET",
    "/api/supplier-configs/configured",
  ),
  listModels: defineEndpoint<void, SupplierProviderModels[]>(
    "GET",
    "/api/supplier-configs/models",
  ),
  save: defineEndpoint<SupplierConfigSaveRequest, SupplierConfig>(
    "PUT",
    "/api/supplier-configs",
  ),
  updateApiKey: defineEndpoint<{provider: string; apiKey: string}, SupplierConfig>(
    "PUT",
    "/api/supplier-configs/api-key",
  ),
  rename: defineEndpoint<{provider: string; alias: string}, SupplierConfig>(
    "PUT",
    "/api/supplier-configs/alias",
  ),
  remove: defineEndpoint<{provider: string}, void>(
    "DELETE",
    "/api/supplier-configs",
  ),
  listOptions: defineEndpoint<{provider?: string}, SupplierModelOption[]>(
    "GET",
    "/api/supplier-configs/options",
  ),
  saveOption: defineEndpoint<SupplierModelOptionSaveRequest, SupplierModelOption>(
    "PUT",
    "/api/supplier-configs/options",
  ),
  removeOption: defineEndpoint<{provider: string; model: string}, void>(
    "DELETE",
    "/api/supplier-configs/options",
  ),
} as const;

/** 供应商配置接口。 */
export interface SupplierConfigApi {
  list: typeof SUPPLIER_CONFIG_ENDPOINTS.list;
  listConfigured: typeof SUPPLIER_CONFIG_ENDPOINTS.listConfigured;
  listModels: typeof SUPPLIER_CONFIG_ENDPOINTS.listModels;
  save: typeof SUPPLIER_CONFIG_ENDPOINTS.save;
  updateApiKey: typeof SUPPLIER_CONFIG_ENDPOINTS.updateApiKey;
  rename: typeof SUPPLIER_CONFIG_ENDPOINTS.rename;
  remove: typeof SUPPLIER_CONFIG_ENDPOINTS.remove;
  listOptions: typeof SUPPLIER_CONFIG_ENDPOINTS.listOptions;
  saveOption: typeof SUPPLIER_CONFIG_ENDPOINTS.saveOption;
  removeOption: typeof SUPPLIER_CONFIG_ENDPOINTS.removeOption;
}
