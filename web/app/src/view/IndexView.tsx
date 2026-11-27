import {LayoutProvider} from "../context/LayoutContext";
import {LoginProvider, ShowLoginDialog} from "../context/LoginContext";
import {ServerConfigModal, ServerProvider, SessionExpiredModal} from "../context/ServerContext";
import {MainLayout} from "./layout/MainLayout";

/** Web 首页视图。 */
export function IndexView() {
  return (
    <ServerProvider>
      <ServerConfigModal/>
      <SessionExpiredModal/>
      <LoginProvider>
        <ShowLoginDialog />
        <LayoutProvider>
          <MainLayout title="首页"/>
        </LayoutProvider>
      </LoginProvider>
    </ServerProvider>
  );
}
