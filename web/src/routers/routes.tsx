import { Route, Router } from "@solidjs/router";

import { HomePage } from "../pages/HomePage";
import { WebLoginPage } from "../pages/LoginPage";
import { WebServerConfigPage } from "../pages/ServerConfigPage";
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

function HomeScreen() {
  return (
    <RequireAuth>
      <HomePage />
    </RequireAuth>
  );
}

/** Web 路由表：先配置服务器，再登录，最后进入 Home。 */
export function AppRouter() {
  return (
    <Router>
      <Route path="/setup" component={SetupScreen} />
      <Route path="/login" component={LoginScreen} />
      <Route path="/" component={HomeScreen} />
    </Router>
  );
}
