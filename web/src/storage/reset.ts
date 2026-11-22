import { clearChatExecutor } from "../chat/executor";
import { clearAllChatMessages } from "./chat_messages";
import { clearUser } from "./user";
import { clearWorkspaceState } from "./workspace";
import { clearWorkspaceTabs } from "./workspace_tabs";
import {clearServerConfig} from "./server_config";

const STORAGE_PREFIX = "loong.web.";
const SERVER_CONFIG_KEY = "loong.web.server-config";

/**
 * 退出服务器时清空所有 Web 本地存储：
 * 登录态、工作区、标签、聊天消息、队列与主题；保留 server-config。
 */
export function clearUserWebStorage(): void {
  clearChatExecutor();
  clearUser();
  clearWorkspaceState();
  clearWorkspaceTabs();
  clearAllChatMessages();

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX) && key !== SERVER_CONFIG_KEY) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // 存储不可用时忽略。
  }
}

export function clearServerWebStorage(): void {
 clearUserWebStorage()
 clearServerConfig()

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX) && key !== SERVER_CONFIG_KEY) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // 存储不可用时忽略。
  }
}




