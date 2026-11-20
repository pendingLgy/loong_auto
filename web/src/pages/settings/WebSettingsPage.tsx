
import { SettingsPage } from "@loong/ui/settings";

/** 设置页：路由 `/settings`，返回首页并渲染共享的 SettingsPage。 */
export function WebSettingsPage() {
  return (
    <div class="mx-auto grid w-full max-w-5xl gap-4 p-6">
      <SettingsPage defaultSection="server" />
    </div>
  );
}
