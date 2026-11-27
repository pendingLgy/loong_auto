import {type Accessor, createSignal, Show,} from "solid-js";

import {type AuthSession, clearAuthSession, readAuthSession, saveAuthSession,} from "../store/auth";
import {useServerContext} from "./ServerContext";
import {LoginDialog} from "../view/login/LoginDialog";
import {createSimpleContext} from "./ContextHelper";


interface LoginContextValue {
  session: Accessor<AuthSession | null>;
  user: Accessor<AuthSession["user"] | null>;
  clearSession: () => void;
  authenticated: Accessor<boolean>;
  completeLogin: (session: Omit<AuthSession, "user_token">) => Promise<void>;
}

async function hashUserToken(user: AuthSession["user"]): Promise<string> {
  const data = new TextEncoder().encode(`${user.id}:${user.username}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}


const loginCtx = createSimpleContext<LoginContextValue>({
  name: "",
  gate: true,
  init: () => {
    const [session, setSession] = createSignal<AuthSession | null>(readAuthSession());


    const completeLogin = async (next: Omit<AuthSession, "user_token">) => {
      const userToken = await hashUserToken(next.user);
      const session = {...next, user_token: userToken};
      setSession(session);
      saveAuthSession(session);
    };

    const clearSession = () => {
      clearAuthSession();
      setSession(null);
    };

    const authenticated = () => session() !== null;
    return {
      session,
      user: () => session()?.user ?? null,
      clearSession,
      authenticated,
      completeLogin
    }

  }
});

export const useLoginContext = loginCtx.use
export const LoginProvider = loginCtx.provider


export function ShowLoginDialog() {

  const {configured} = useServerContext();
  const {authenticated, completeLogin} = useLoginContext()
  return (
    <Show when={!authenticated() && configured()}>
      <LoginDialog onComplete={completeLogin}/>
    </Show>
  );
}

