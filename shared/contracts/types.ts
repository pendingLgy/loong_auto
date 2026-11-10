/** 与 Python 公共契约对应；边界生成与一致性检查见 README。 */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface ToolDefinition { name: string; description: string; parameters: Record<string, Json> }
export interface CreateTask {
  workspace_id: string; prompt: string; idempotency_key: string; tools?: ToolDefinition[];
}
export interface Task {
  id: string; workspace_id: string;
  status: "queued" | "running" | "waiting_tool" | "completed" | "failed" | "cancelled";
  answer: string | null; error: string | null; created_at: string; updated_at: string;
}
export interface ToolCall {
  id: string; task_id: string; workspace_id: string; provider_call_id: string;
  name: string; arguments: Record<string, Json>;
  status: "pending" | "succeeded" | "failed" | "rejected" | "cancelled" | "unknown";
}
export interface ToolResult {
  status: Exclude<ToolCall["status"], "pending">;
  stdout?: string; stderr?: string; exit_code?: number | null; data?: Json; truncated?: boolean;
}
export interface TaskDetail { task: Task; calls: ToolCall[] }
export interface TaskEvent {
  protocol_version: "1.0"; id: number; task_id: string; timestamp: string;
  type: "task.created" | "task.running" | "model.text" | "tool.request" | "tool.result" |
    "task.completed" | "task.failed" | "task.cancelled";
  payload: Record<string, Json>;
}

export interface BaseResponse<T> {
  code: number; msg: string; data: T | null; request_date: string; request_id: string;
}
