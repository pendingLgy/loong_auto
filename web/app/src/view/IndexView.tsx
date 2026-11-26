import {LayoutProvider} from "../context/LayoutContext";
import {LoginProvider} from "../context/LoginContext";
import {LocaleProvider} from "../context/LocaleContext";
import {ServerProvider} from "../context/ServerContext";
import {MainLayout} from "./layout/MainLayout";

/** Web 首页视图。 */
export function IndexView() {
  return (
    <LocaleProvider>
      <ServerProvider>
        <LoginProvider>
          <LayoutProvider>
            <MainLayout title="首页"/>
          </LayoutProvider>
        </LoginProvider>
      </ServerProvider>
    </LocaleProvider>

  );
}
