import { Route, Router } from "@solidjs/router";
import type { JSX } from "solid-js";

import { HomeIndex } from "../pages/home/HomeIndex";
import { HomePage } from "../pages/home/HomePage";
import { WebLoginPage } from "../pages/login/WebLoginPage";
import { WebServerConfigPage } from "../pages/server-config/WebServerConfigPage";
import { WebSettingsPage } from "../pages/settings/WebSettingsPage";
import { GuestOnly, RequireAuth, RequireServerConfig, SetupOnly } from "./guards";

function SetupScreen() {
  return (
    <SetupOnly>
      <WebServerConfigPage />
    </SetupOnly>
  );
}

function LoginScreen() {
  return (
    <RequireServerConfig>
      <GuestOnly>
        <WebLoginPage />
      </GuestOnly>
    </RequireServerConfig>
  );
}

function HomeScreen(props: { children?: JSX.Element }) {
  return (
    <RequireAuth>
      <HomePage>{props.children}</HomePage>
    </RequireAuth>
  );
}

function SettingsScreen() {
  return <WebSettingsPage />;
}

/** Web 路由表：先配置服务器，再登录，最后进入 Home。 */
export function AppRouter() {
  return (
    <Router>
      <Route path="/setup" component={SetupScreen} />
      <Route path="/login" component={LoginScreen} />
      <Route path="/" component={HomeScreen}>
        <Route path="/" component={HomeIndex} />
        <Route path="settings" component={SettingsScreen} />
      </Route>
    </Router>
  );
}
