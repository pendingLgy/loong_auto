/** Web 应用内 window 事件统一管理。 */

/** 新会话创建完成。 */
export const SESSION_CREATED_EVENT = "loong:session-created";
/** 会话配置发生变化。 */
export const SESSION_CONFIG_EVENT = "loong:session-config";

export interface SessionCreatedEventDetail {
  workspaceId: string;
  workspaceName?: string;
  sessionId: string;
  title: string;
}

export interface SessionConfigEventDetail {
  sessionId: string;
}

/** 派发新会话创建完成事件。 */
export function notifySessionCreated(detail: SessionCreatedEventDetail): void {
  window.dispatchEvent(new CustomEvent(SESSION_CREATED_EVENT, {detail}));
}

/** 派发会话配置变化事件。 */
export function notifySessionConfig(detail: SessionConfigEventDetail): void {
  window.dispatchEvent(new CustomEvent(SESSION_CONFIG_EVENT, {detail}));
}
