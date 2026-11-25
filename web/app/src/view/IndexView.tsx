import {LayoutProvider} from "../context/LayoutContext";
import {ServerProvider} from "../context/ServerContext";
import {MainLayout} from "./layout/MainLayout";

/** Web 首页视图。 */
export function IndexView() {

  return (
    <ServerProvider>
      <LayoutProvider>
        <MainLayout
          title="首页"
          left={
            <>
              left
            </>
          }
          right={
            <>
              right
            </>
          }
        >
          center
        </MainLayout>
      </LayoutProvider>
    </ServerProvider>
  )
}
