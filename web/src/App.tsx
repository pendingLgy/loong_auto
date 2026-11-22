import { Show, createEffect, onCleanup } from "solid-js";

import { Dialog } from "@loong/ui/dialog";
import { Message } from "@loong/ui/message";

import { AppRouter } from "./routers";
import { clearNotice, notice } from "./storage/app_notice";
import { authExpired, clearAuthExpired } from "./storage/auth_notice";

/** 登录过期提示：3 秒后返回工作区重新登录。 */
function AuthExpiredPrompt() {
  createEffect(() => {
    if (!authExpired()) return;

    const timer = window.setTimeout(() => {
      clearAuthExpired();
      window.location.assign("/");
    }, 3000);
    onCleanup(() => window.clearTimeout(timer));
  });

  return (
    <Dialog
      open={authExpired()}
      onClose={() => undefined}
      closable={false}
      closeOnOverlay={false}
      size="sm"
      header={
        <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
          登录已过期
        </h2>
      }
    >
      <p class="m-0 text-sm text-slate-600 dark:text-slate-300">
        登录已过期，请重新登录。3 秒后将返回首页。
      </p>
    </Dialog>
  );
}



/** 全局操作提示：使用 Message 展示，3 秒后自动消失。 */
function AppNotice() {
  createEffect(() => {
    if (!notice()) return;

    const timer = window.setTimeout(() => clearNotice(), 3000);
    onCleanup(() => window.clearTimeout(timer));
  });

  return (
    <Show when={notice()}>
      {(current) => (
        <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <Message type={current().type}>{current().text}</Message>
        </div>
      )}
    </Show>
  );
}

/** 应用根组件：路由配置全部位于 `src/routers`。 */
export function App() {
  return (
    <>
      <AppRouter />
      <AuthExpiredPrompt />
      <AppNotice />
    </>
  );
}
