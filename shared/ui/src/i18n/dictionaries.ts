/**
 * 共享 UI 的多语言字典。
 *
 * 中文不在此维护：中文文案作为调用方 `translate` 的 fallback 内联在组件里，
 * 字典只维护其它语言，并用 `Record<MessageKey, string>` 强制 key 对齐。
 */
export const enUS = {
  "login.title": "Sign in to Loong",
  "login.description": "Use your Loong account to continue",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.pending": "Signing in…",
  "login.success": "Signed in: {{ username }}",
  "login.errors.usernameRequired": "Username is required",
  "login.errors.passwordRequired": "Password is required",
  "login.errors.fallback": "Sign in failed. Please try again.",
  "login.errors.usernameSpace": "Username cannot contain spaces",
  "login.errors.passwordTooShort": "Password must be at least 8 characters",
  "login.errors.invalidCredentials": "Incorrect username or password",
  "serverConfig.title": "Configure server",
  "serverConfig.description": "Enter the local gateway URL and access token",
  "serverConfig.serverUrl": "Server URL",
  "serverConfig.serverUrlPlaceholder": "http://127.0.0.1:9528",
  "serverConfig.token": "Token",
  "serverConfig.tokenPlaceholder": "Paste your access token",
  "serverConfig.submit": "Save configuration",
  "serverConfig.saving": "Saving…",
  "serverConfig.success": "Configuration saved",
  "serverConfig.errors.serverUrlRequired": "Server URL is required",
  "serverConfig.errors.serverUrlInvalid": "Server URL must be a valid http or https URL",
  "serverConfig.errors.tokenRequired": "Token is required",
  "serverConfig.errors.fallback": "Failed to save. Please try again.",
  "layout.collapseLeft": "Collapse left panel",
  "layout.expandLeft": "Expand left panel",
  "layout.collapseRight": "Collapse right panel",
  "layout.expandRight": "Expand right panel",
  "layout.resizeLeft": "Resize left panel",
  "layout.resizeRight": "Resize right panel",
  "layout.saved": "Saved layout: {{ state }}",
  "nav.newChat": "New chat",
  "nav.automationTasks": "Automation tasks",
  "nav.label": "Main navigation",
  "nav.workspaces": "Workspaces",
  "nav.emptyWorkspaces": "No workspaces yet",
  "nav.searchWorkspaces": "Search workspaces",
  "nav.createWorkspace": "New workspace",
  "nav.moreWorkspace": "More workspace actions",
  "nav.newConversation": "New conversation",
  "nav.userMenu": "User menu",
  "nav.userFallback": "Not signed in",
  "nav.settings": "Settings",
} as const;

export type MessageKey = keyof typeof enUS;

export type Messages = typeof enUS;
