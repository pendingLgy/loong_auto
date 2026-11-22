/** 消息执行状态，与云端 GlobalMessageStatus 对齐。 */
export const MessageStatus = {
  START: "start",
  RUNNING: "running",
  TOOL_CALLING: "tool_calling",
  TOOL_APPROVAL_REQUIRED: "tool_approval_required",
  TOOL_CALLED: "tool_called",
  STOP: "stop",
} as const;

export type MessageStatusValue = typeof MessageStatus[keyof typeof MessageStatus];

const MESSAGE_STATUSES = new Set<string>(Object.values(MessageStatus));

/** 判断并收窄为合法消息状态。 */
export function asMessageStatus(value: unknown): MessageStatusValue | undefined {
  return typeof value === "string" && MESSAGE_STATUSES.has(value)
    ? value as MessageStatusValue
    : undefined;
}
