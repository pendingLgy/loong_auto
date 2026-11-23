import { Effect } from "effect";

import { requestJson, type HttpClientOptions } from "../http";
import type {
  RawSupplierConfigPayload,
  RawSupplierModelItemPayload,
  RawSupplierModelOptionPayload,
  RawSupplierProviderModelsPayload,
  SupplierConfig,
  SupplierProviderModels,
  SupplierConfigSaveRequest,
  SupplierModelOption,
  SupplierModelOptionSaveRequest,
} from "../types";
import { ClientError } from "../types/errors";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** 原始供应商配置 → 客户端领域模型。 */
export function toSupplierConfig(payload: RawSupplierConfigPayload): SupplierConfig {
  return {
    id: asText(payload.id),
    provider: asText(payload.provider),
    alias: asNullableText(payload.alias),
    baseUrl: asNullableText(payload.base_url),
    popular: payload.popular === true,
    description: asText(payload.description),
    configFlag: payload.config_flag === true,
    createdAt: asNullableText(payload.created_at),
    updatedAt: asNullableText(payload.updated_at),
  };
}

/** 原始模型启用配置 → 客户端领域模型。 */
export function toSupplierModelOption(payload: RawSupplierModelOptionPayload): SupplierModelOption {
  return {
    id: asText(payload.id),
    provider: asText(payload.provider),
    model: asText(payload.model),
    enabled: typeof payload.enabled === "boolean" ? payload.enabled : true,
    createdAt: asNullableText(payload.created_at),
    updatedAt: asNullableText(payload.updated_at),
  };
}

function configList(payload: unknown): SupplierConfig[] {
  return Array.isArray(payload)
    ? payload.map((item) => toSupplierConfig(asRecord(item) ?? {}))
    : [];
}

function toProviderModels(payload: RawSupplierProviderModelsPayload): SupplierProviderModels {
  const rawModels = Array.isArray(payload.models) ? payload.models : [];
  return {
    provider: asText(payload.provider),
    alias: asNullableText(payload.alias),
    baseUrl: asNullableText(payload.base_url),
    models: rawModels
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item: RawSupplierModelItemPayload) => ({
        model: asText(item.model),
        enabled: item.enabled !== false,
        reasoningEffort: Array.isArray(item.reasoning_effort)
          ? item.reasoning_effort.filter((value): value is string => typeof value === "string")
          : [],
      }))
      .filter((item) => item.model.length > 0),
  };
}

function providerModelList(payload: unknown): SupplierProviderModels[] {
  return Array.isArray(payload)
    ? payload
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => toProviderModels(item))
    : [];
}

function optionList(payload: unknown): SupplierModelOption[] {
  return Array.isArray(payload)
    ? payload.map((item) => toSupplierModelOption(asRecord(item) ?? {}))
    : [];
}

/** 供应商配置与模型启用配置接口。 */
export class SupplierConfigApi {
  static readonly httpMethods = {
    list: "GET",
    listConfigured: "GET",
    listModels: "GET",
    listOptions: "GET",
  } as const;


  constructor(private readonly options: HttpClientOptions) {}

  list(): Effect.Effect<SupplierConfig[], ClientError> {
    return requestJson<unknown>(this.options, "/api/supplier-configs")
      .pipe(Effect.map(configList));
  }

  listConfigured(): Effect.Effect<SupplierConfig[], ClientError> {
    return requestJson<unknown>(this.options, "/api/supplier-configs/configured")
      .pipe(Effect.map(configList));
  }

  listModels(): Effect.Effect<SupplierProviderModels[], ClientError> {
    return requestJson<unknown>(this.options, "/api/supplier-configs/models")
      .pipe(Effect.map(providerModelList));
  }

  save(request: SupplierConfigSaveRequest): Effect.Effect<SupplierConfig, ClientError> {
    return requestJson<RawSupplierConfigPayload>(this.options, "/api/supplier-configs", {
      method: "PUT",
      body: {
        provider: request.provider,
        api_key: request.apiKey,
        base_url: request.baseUrl,
      },
    }).pipe(Effect.map(toSupplierConfig));
  }

  updateApiKey(provider: string, apiKey: string): Effect.Effect<SupplierConfig, ClientError> {
    return requestJson<RawSupplierConfigPayload>(this.options, "/api/supplier-configs/api-key", {
      method: "PUT",
      body: { provider, api_key: apiKey },
    }).pipe(Effect.map(toSupplierConfig));
  }

  rename(provider: string, alias: string): Effect.Effect<SupplierConfig, ClientError> {
    return requestJson<RawSupplierConfigPayload>(this.options, "/api/supplier-configs/alias", {
      method: "PUT",
      body: { provider, alias },
    }).pipe(Effect.map(toSupplierConfig));
  }

  remove(provider: string): Effect.Effect<void, ClientError> {
    const query = new URLSearchParams({ provider }).toString();
    return requestJson<boolean>(this.options, `/api/supplier-configs?${query}`, {
      method: "DELETE",
    }).pipe(Effect.map(() => undefined));
  }

  listOptions(provider?: string): Effect.Effect<SupplierModelOption[], ClientError> {
    const query = provider
      ? `?${new URLSearchParams({ provider }).toString()}`
      : "";
    return requestJson<unknown>(this.options, `/api/supplier-configs/options${query}`)
      .pipe(Effect.map(optionList));
  }

  saveOption(request: SupplierModelOptionSaveRequest): Effect.Effect<SupplierModelOption, ClientError> {
    return requestJson<RawSupplierModelOptionPayload>(this.options, "/api/supplier-configs/options", {
      method: "PUT",
      body: {
        provider: request.provider,
        model: request.model,
        enabled: request.enabled,
      },
    }).pipe(Effect.map(toSupplierModelOption));
  }

  removeOption(provider: string, model: string): Effect.Effect<void, ClientError> {
    const query = new URLSearchParams({ provider, model }).toString();
    return requestJson<boolean>(this.options, `/api/supplier-configs/options?${query}`, {
      method: "DELETE",
    }).pipe(Effect.map(() => undefined));
  }
}
