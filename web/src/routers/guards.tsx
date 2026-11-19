import { Navigate } from "@solidjs/router";
import { Show, type ParentComponent } from "solid-js";

import { isServerConfigured } from "../storage/server_config";
import { userSession } from "../storage/user";

/** 未配置服务器时跳转配置页。 */
export const RequireServerConfig: ParentComponent = (props) => (
  <Show when={isServerConfigured()} fallback={<Navigate href="/setup" />}>
    {props.children}
  </Show>
);

/** 未登录时跳转登录页（登录页自身再要求已配置）。 */
export const RequireAuth: ParentComponent = (props) => (
  <RequireServerConfig>
    <Show when={userSession()} fallback={<Navigate href="/login" />}>
      {props.children}
    </Show>
  </RequireServerConfig>
);

/** 仅未登录时展示（登录页）。 */
export const GuestOnly: ParentComponent = (props) => (
  <Show when={!userSession()} fallback={<Navigate href="/" />}>
    {props.children}
  </Show>
);

/** 仅未配置时展示（配置页）。 */
export const SetupOnly: ParentComponent = (props) => (
  <Show when={!isServerConfigured()} fallback={<Navigate href="/" />}>
    {props.children}
  </Show>
);
