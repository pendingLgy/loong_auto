import type {
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceListParams,
  WorkspacePage,
  WorkspaceUpdateRequest,
} from "../types";
import type { ApiEndpoint } from "../config";

export interface ListWorkspaceEndpoint
  extends ApiEndpoint<WorkspaceListParams, WorkspacePage, "GET", "/api/cloud/common/api/workspace"> {}

export interface CreateWorkspaceEndpoint
  extends ApiEndpoint<WorkspaceCreateRequest, Workspace, "POST", "/api/cloud/common/api/workspace"> {}

export interface GetWorkspaceEndpoint
  extends ApiEndpoint<{id: number | string}, Workspace, "GET", "/api/cloud/common/api/workspace/{id}"> {}

export interface UpdateWorkspaceEndpoint
  extends ApiEndpoint<
    {id: number | string; request: WorkspaceUpdateRequest},
    Workspace,
    "PUT",
    "/api/cloud/common/api/workspace/{id}"
  > {}

export interface RemoveWorkspaceEndpoint
  extends ApiEndpoint<{id: number | string}, void, "DELETE", "/api/cloud/common/api/workspace/{id}"> {}

/** 工作区接口。 */
export interface WorkspaceApi {
  list: ListWorkspaceEndpoint;
  create: CreateWorkspaceEndpoint;
  get: GetWorkspaceEndpoint;
  update: UpdateWorkspaceEndpoint;
  remove: RemoveWorkspaceEndpoint;
}
