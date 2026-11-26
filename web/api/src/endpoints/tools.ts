import { defineEndpoint } from "../core";
import type { ToolApprovalMessage, ToolApprovalRequest } from "../types";

export const TOOL_ENDPOINTS = {
  approve: defineEndpoint<
    {sessionId: string; toolId: string; request: ToolApprovalRequest},
    ToolApprovalMessage
  >(
    "POST",
    "/api/tools/{sessionId}/approved/{toolId}",
  ),
} as const;

/** 工具审批接口。 */
export interface ToolsApi {
  approve: typeof TOOL_ENDPOINTS.approve;
}
