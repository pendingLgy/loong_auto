import { Effect } from "effect";

import { requestJson, type HttpClientOptions } from "../http";
import type {
  RawToolApprovalMessagePayload,
  ToolApprovalMessage,
  ToolApprovalRequest,
} from "../types";
import { ClientError } from "../types/errors";

function segment(value: string): string {
  return encodeURIComponent(value);
}

function asNullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toToolMessage(payload: RawToolApprovalMessagePayload): ToolApprovalMessage {
  return {
    id: asNullableText(payload.id),
    role: asNullableText(payload.role) ?? "tool",
    status: asNullableText(payload.status),
    content: typeof payload.content === "string" ? payload.content : "",
    toolCallId: asNullableText(payload.tool_call_id),
  };
}

/** 本地工具审批接口。 */
export class ToolsApi {
  constructor(private readonly options: HttpClientOptions) {}

  /** 同意或拒绝待审批工具；同意时由本地执行器实际执行。 */
  approve(
    sessionId: string,
    toolId: string,
    request: ToolApprovalRequest,
  ): Effect.Effect<ToolApprovalMessage, ClientError> {
    return requestJson<RawToolApprovalMessagePayload>(
      this.options,
      `/api/tools/${segment(sessionId)}/approved/${segment(toolId)}`,
      {
        method: "POST",
        body: {approved: request.approved},
      },
    ).pipe(Effect.map(toToolMessage));
  }
}
