import { defineEndpoint } from "../core";
import type {
  WorkspaceResponse,
  WorkspaceCreateRequest,
  WorkspaceListRequest,
  WorkspacePageResponse,
  WorkspaceUpdateRequest,
} from "../types";

export const WORKSPACE_ENDPOINTS = {
  list: defineEndpoint<WorkspaceListRequest, WorkspacePageResponse>(
    "GET",
    "/api/cloud/common/api/workspace",
  ),
  create: defineEndpoint<WorkspaceCreateRequest, WorkspaceResponse>(
    "POST",
    "/api/cloud/common/api/workspace",
  ),
  get: defineEndpoint<{id: number | string}, WorkspaceResponse>(
    "GET",
    "/api/cloud/common/api/workspace/{id}",
  ),
  update: defineEndpoint<
    {id: number | string; request: WorkspaceUpdateRequest},
    WorkspaceResponse
  >(
    "PUT",
    "/api/cloud/common/api/workspace/{id}",
  ),
  remove: defineEndpoint<{id: number | string}, void>(
    "DELETE",
    "/api/cloud/common/api/workspace/{id}",
  ),
} as const;

/** 工作区接口。 */
export interface WorkspaceApi {
  list: typeof WORKSPACE_ENDPOINTS.list;
  create: typeof WORKSPACE_ENDPOINTS.create;
  get: typeof WORKSPACE_ENDPOINTS.get;
  update: typeof WORKSPACE_ENDPOINTS.update;
  remove: typeof WORKSPACE_ENDPOINTS.remove;
}
