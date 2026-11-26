import { LayoutProvider } from "../context/LayoutContext";
import { LocaleProvider } from "../context/LocaleContext";
import { ServerProvider } from "../context/ServerContext";
import { MainLayout } from "./layout/MainLayout";

/** Web 首页视图。 */
export function IndexView() {
  return (
    <ServerProvider>
      <LocaleProvider>
        <LayoutProvider>
          <MainLayout title="首页" />
        </LayoutProvider>
      </LocaleProvider>
    </ServerProvider>
  );
}
