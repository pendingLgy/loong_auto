import type {
  SupplierConfig,
  SupplierConfigSaveRequest,
  SupplierModelOption,
  SupplierModelOptionSaveRequest,
  SupplierProviderModels,
} from "../types";
import type { ApiEndpoint } from "../config";

export interface ListSupplierEndpoint
  extends ApiEndpoint<void, SupplierConfig[], "GET", "/api/supplier-configs"> {}

export interface ListConfiguredSupplierEndpoint
  extends ApiEndpoint<void, SupplierConfig[], "GET", "/api/supplier-configs/configured"> {}

export interface ListSupplierModelsEndpoint
  extends ApiEndpoint<void, SupplierProviderModels[], "GET", "/api/supplier-configs/models"> {}

export interface SaveSupplierEndpoint
  extends ApiEndpoint<SupplierConfigSaveRequest, SupplierConfig, "PUT", "/api/supplier-configs"> {}

export interface UpdateSupplierApiKeyEndpoint
  extends ApiEndpoint<{provider: string; apiKey: string}, SupplierConfig, "PUT", "/api/supplier-configs/api-key"> {}

export interface UpdateSupplierAliasEndpoint
  extends ApiEndpoint<{provider: string; alias: string}, SupplierConfig, "PUT", "/api/supplier-configs/alias"> {}

export interface RemoveSupplierEndpoint
  extends ApiEndpoint<{provider: string}, void, "DELETE", "/api/supplier-configs"> {}

export interface ListSupplierOptionsEndpoint
  extends ApiEndpoint<{provider?: string}, SupplierModelOption[], "GET", "/api/supplier-configs/options"> {}

export interface SaveSupplierOptionEndpoint
  extends ApiEndpoint<SupplierModelOptionSaveRequest, SupplierModelOption, "PUT", "/api/supplier-configs/options"> {}

export interface RemoveSupplierOptionEndpoint
  extends ApiEndpoint<{provider: string; model: string}, void, "DELETE", "/api/supplier-configs/options"> {}

/** 供应商配置接口。 */
export interface SupplierConfigApi {
  list: ListSupplierEndpoint;
  listConfigured: ListConfiguredSupplierEndpoint;
  listModels: ListSupplierModelsEndpoint;
  save: SaveSupplierEndpoint;
  updateApiKey: UpdateSupplierApiKeyEndpoint;
  rename: UpdateSupplierAliasEndpoint;
  remove: RemoveSupplierEndpoint;
  listOptions: ListSupplierOptionsEndpoint;
  saveOption: SaveSupplierOptionEndpoint;
  removeOption: RemoveSupplierOptionEndpoint;
}
