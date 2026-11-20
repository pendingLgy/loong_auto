import { Route, Router } from "@solidjs/router";
import { HomeTabsView } from "../pages/home-tabs/HomeTabsView";
import { WebServerConfigPage } from "../pages/server-config/WebServerConfigPage";
import { WebSettingsPage } from "../pages/settings/WebSettingsPage";
import { RequireServerConfig, SetupOnly } from "./guards";

function SetupScreen() {
  return (
    <SetupOnly>
      <WebServerConfigPage />
    </SetupOnly>
  );
}

function HomeTabsViewScreen() {
  return (
    <RequireServerConfig>
      <HomeTabsView />
    </RequireServerConfig>
  );
}

function SettingsScreen() {
  return (
    <RequireServerConfig>
      <WebSettingsPage />
    </RequireServerConfig>
  );
}

/** Web 路由表：先配置服务器，根路由渲染 HomeTabsView。 */
export function AppRouter() {
  return (
    <Router>
      <Route path="/setup" component={SetupScreen} />
      <Route path="/" component={HomeTabsViewScreen} />
      <Route path="/settings" component={SettingsScreen} />
    </Router>
  );
}
