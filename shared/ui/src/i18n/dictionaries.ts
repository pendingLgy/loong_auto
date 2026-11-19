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
} as const;

export type MessageKey = keyof typeof enUS;

export type Messages = typeof enUS;
