import {
  Show,
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js";

import {
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
  type AuthSession,
} from "../store/auth";
import { useServerContext } from "./ServerContext";
import { LoginDialog } from "../view/login/LoginDialog";

interface LoginContextValue {
  session: Accessor<AuthSession | null>;
  user: Accessor<AuthSession["user"] | null>;
  accessToken: Accessor<string | null>;
  authenticated: Accessor<boolean>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  completeLogin: (session: AuthSession) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
  setError: (message: string | null) => void;
}

const LoginContext = createContext<LoginContextValue>();

/** 登录上下文：只负责会话状态与持久化。 */
export function LoginProvider(props: ParentProps) {
  const {configured} = useServerContext();
  const [session, setSession] = createSignal<AuthSession | null>(readAuthSession());
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const completeLogin = (next: AuthSession) => {
    setSession(next);
    saveAuthSession(next);
  };

  const clearSession = () => {
    clearAuthSession();
    setSession(null);
    setError(null);
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
        completeLogin,
        clearSession,
        setLoading,
        setError,
      }}
    >
      {props.children}
      <ShowLoginDialog
        open={!authenticated() && configured()}
        loading={loading()}
        error={error()}
        onComplete={completeLogin}
        onLoadingChange={setLoading}
        onError={setError}
      />
    </LoginContext>
  );
}

function ShowLoginDialog(props: {
  open: boolean;
  loading: boolean;
  error: string | null;
  onComplete: (session: AuthSession) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string | null) => void;
}) {
  return (
    <Show when={props.open}>
      <LoginDialog
        loading={props.loading}
        error={props.error}
        onComplete={props.onComplete}
        onLoadingChange={props.onLoadingChange}
        onError={props.onError}
      />
    </Show>
  );
}

/** 读取登录上下文，必须在 LoginProvider 内使用。 */
export function useLoginContext(): LoginContextValue {
  return useContext(LoginContext);
}
