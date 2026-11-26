import { defineEndpoint } from "../core";
import type {
  SupplierConfigApiKeyRequest,
  SupplierConfigDeleteRequest,
  SupplierConfigOptionsRequest,
  SupplierConfigRenameRequest,
  SupplierConfigResponse,
  SupplierConfigSaveRequest,
  SupplierModelOptionDeleteRequest,
  SupplierModelOptionResponse,
  SupplierModelOptionSaveRequest,
  SupplierProviderModelsResponse,
} from "../types";

export const SUPPLIER_CONFIG_ENDPOINTS = {
  list: defineEndpoint<void, SupplierConfigResponse[]>(
    "GET",
    "/api/supplier-configs",
  ),
  listConfigured: defineEndpoint<void, SupplierConfigResponse[]>(
    "GET",
    "/api/supplier-configs/configured",
  ),
  listModels: defineEndpoint<void, SupplierProviderModelsResponse[]>(
    "GET",
    "/api/supplier-configs/models",
  ),
  save: defineEndpoint<SupplierConfigSaveRequest, SupplierConfigResponse>(
    "PUT",
    "/api/supplier-configs",
  ),
  updateApiKey: defineEndpoint<SupplierConfigApiKeyRequest, SupplierConfigResponse>(
    "PUT",
    "/api/supplier-configs/api-key",
  ),
  rename: defineEndpoint<SupplierConfigRenameRequest, SupplierConfigResponse>(
    "PUT",
    "/api/supplier-configs/alias",
  ),
  remove: defineEndpoint<SupplierConfigDeleteRequest, void>(
    "DELETE",
    "/api/supplier-configs",
  ),
  listOptions: defineEndpoint<SupplierConfigOptionsRequest, SupplierModelOptionResponse[]>(
    "GET",
    "/api/supplier-configs/options",
  ),
  saveOption: defineEndpoint<SupplierModelOptionSaveRequest, SupplierModelOptionResponse>(
    "PUT",
    "/api/supplier-configs/options",
  ),
  removeOption: defineEndpoint<SupplierModelOptionDeleteRequest, void>(
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
