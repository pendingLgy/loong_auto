import type {
  AuthApi,
  EventsApi,
  HealthApi,
  MessageApi,
  SessionApi,
  SessionConfigApi,
  SupplierConfigApi,
  ToolsApi,
  WorkspaceApi,
} from "./sdk";

/** Web 使用的本地 API 接口集合。 */
export interface ApiClient {
  auth: AuthApi;
  health: HealthApi;
  sessionConfig: SessionConfigApi;
  supplierConfig: SupplierConfigApi;
  workspace: WorkspaceApi;
  session: SessionApi;
  message: MessageApi;
  events: EventsApi;
  tools: ToolsApi;
}

/** 复用 shared/client 的实际请求实现。 */
export {createLocalClient} from "@loong/client";
