import { Effect } from "effect";
import type { Component } from "solid-js";

import { LoginDialog as UiLoginDialog, type LoginCredentials, type RegisterValues } from "@loong/ui/login";

import { createApiClient } from "../../api";
import { saveUser } from "../../storage/user";

export interface LoginViewProps {
  /** 当前服务器 ID，登录信息按该 ID 保存。 */
  serverId: string;
  /** 服务器名称，用于标题展示。 */
  serverName?: string;
}

/** Web 登录弹窗：把共享 LoginDialog 的登录 / 注册动作接到本地网关与存储。 */
export const LoginView: Component<LoginViewProps> = (props) => {
  const login = async (credentials: LoginCredentials) => {
    const client = createApiClient();
    const session = await Effect.runPromise(
      client.auth.login({
        username: credentials.username,
        password: credentials.password,
        platform: "web",
      }),
    );
    saveUser(session, props.serverId);
  };

  const register = async (values: RegisterValues) => {
    const client = createApiClient();
    await Effect.runPromise(client.auth.register(values));
  };

  return (
    <UiLoginDialog
      open
      serverName={props.serverName}
      overlayClass="absolute inset-0"
      onLogin={login}
      onRegister={register}
    />
  );
};
