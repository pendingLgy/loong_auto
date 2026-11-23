import { Route, Router } from "@solidjs/router";
import { HomeView } from "../views/home/HomeView";
import { WebServerConfigView } from "../views/server-config/WebServerConfigView";
import { WebSettingsView } from "../views/settings/WebSettingsView";
import { RequireServerConfig, SetupOnly } from "./guards";

function SetupScreen() {
  return (
    <SetupOnly>
      <WebServerConfigView />
    </SetupOnly>
  );
}

function HomeViewScreen() {
  return (
    <RequireServerConfig>
      <HomeView />
    </RequireServerConfig>
  );
}

function SettingsScreen() {
  return (
    <RequireServerConfig>
      <WebSettingsView />
    </RequireServerConfig>
  );
}

/** Web 路由表：先配置服务器，根路由渲染 HomeTabsView。 */
export function AppRouter() {
  return (
    <Router>
      <Route path="/setup" component={SetupScreen} />
      <Route path="/chat/:sessionId" component={HomeViewScreen} />
      <Route path="/" component={HomeViewScreen} />
      <Route path="/settings" component={SettingsScreen} />
    </Router>
  );
}
