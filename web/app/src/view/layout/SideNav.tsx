import {useLayoutContext} from "../../context/LayoutContext";
import {useLoginContext} from "../../context/LoginContext";
import {useServerContext} from "../../context/ServerContext";
import {useSideNavContext} from "../../context/SideNavContext";
import {ExitClientDialog} from "../user/ExitClientDialog";
import {SideNavCenter} from "./side_nav/SideNavCenter";
import {SideNavFooter} from "./side_nav/SideNavFooter";
import {SideNavHeader} from "./side_nav/SideNavHeader";

/** 左侧导航：客户端信息、语言、主题、用户与设置入口。 */
export function SideNav() {
  const {layout} = useLayoutContext();
  const {clearSession} = useLoginContext();
  const {disconnectServer} = useServerContext();
  const {exitConfirm, setExitConfirm} = useSideNavContext();

  const left_width = () => layout().left_width;
  const left_open = () => layout().left_open;
  return (
    <>
      <aside
        aria-label="左侧导航"
        aria-hidden={left_open() ? "false" : "true"}
        style={{
          width: left_open() ? `${left_width()}px` : "0px",
          "min-width": left_open() ? "200px" : "0px",
        }}
        class={`${left_open() ? "max-lg:hidden lg:flex opacity-100" : "flex opacity-0 pointer-events-none"} shrink-0 flex-col overflow-hidden rounded-xl bg-white/70 shadow-sm transition-[width,min-width,opacity] duration-200 ease-out dark:bg-slate-900/60`}
      >
        <SideNavHeader/>
        <SideNavCenter/>
        <SideNavFooter/>
      </aside>

      <ExitClientDialog
        open={exitConfirm()}
        onOpenChange={setExitConfirm}
        onConfirm={() => {
          disconnectServer();
          clearSession();
        }}
      />

    </>
  );
}
