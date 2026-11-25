import type { ToolApprovalMessage, ToolApprovalRequest } from "../types";
import type { ApiEndpoint } from "../config";

export interface ApproveToolEndpoint
  extends ApiEndpoint<
    {sessionId: string; toolId: string; request: ToolApprovalRequest},
    ToolApprovalMessage,
    "POST",
    "/api/tools/{sessionId}/approved/{toolId}"
  > {}

/** 工具审批接口。 */
export interface ToolsApi {
  approve: ApproveToolEndpoint;
}
