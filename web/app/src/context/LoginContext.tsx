import {
  Show,
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js";
import { Effect } from "effect";
import { createLocalClient, type LoginResponse, type UserInfo } from "@loong/web-api";

import {
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
  type AuthSession,
} from "../store/auth";
import { LoginDialog } from "../view/login/LoginDialog";
import { useServerContext } from "./ServerContext";

interface LoginContextValue {
  session: Accessor<AuthSession | null>;
  user: Accessor<UserInfo | null>;
  accessToken: Accessor<string | null>;
  authenticated: Accessor<boolean>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, name?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const LoginContext = createContext<LoginContextValue>();

function toSession(response: LoginResponse): AuthSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    tokenType: response.tokenType,
    expiresIn: response.expiresIn,
    user: response.user,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 登录上下文：会话恢复、登录、注册与退出。 */
export function LoginProvider(props: ParentProps) {
  const {serverUrl, securityToken, configured} = useServerContext();
  const [session, setSession] = createSignal<AuthSession | null>(readAuthSession());
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const client = () => createLocalClient({
    origin: serverUrl(),
    security_token: securityToken(),
  });

  const login = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await Effect.runPromise(client().auth.login({
        username,
        password,
        platform: "web",
      }));
      const next = toSession(response);
      setSession(next);
      saveAuthSession(next);
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    username: string,
    password: string,
    name?: string,
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await Effect.runPromise(client().auth.register({username, password, name}));
    } catch (reason) {
      setError(errorMessage(reason));
      setLoading(false);
      return false;
    }
    setLoading(false);
    return login(username, password);
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      if (session()) {
        await Effect.runPromise(client().auth.logout());
      }
    } catch {
      // 本地会话仍然需要清除，网关退出失败不阻塞登出。
    } finally {
      clearAuthSession();
      setSession(null);
      setError(null);
      setLoading(false);
    }
  };

  const authenticated = () => session() !== null;

  return (
    <LoginContext
      value={{
        session,
        user: () => session()?.user ?? null,
        accessToken: () => session()?.accessToken ?? null,
        authenticated,
        loading,
        error,
        login,
        register,
        logout,
        clearError: () => setError(null),
      }}
    >
      {props.children}
      <Show when={!authenticated() && configured()}>
        <LoginDialog
          loading={loading()}
          error={error()}
          onLogin={login}
          onRegister={register}
          onClearError={() => setError(null)}
        />
      </Show>
    </LoginContext>
  );
}

/** 读取登录上下文，必须在 LoginProvider 内使用。 */
export function useLoginContext(): LoginContextValue {
  return useContext(LoginContext);
}
