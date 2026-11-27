import { Show, createSignal } from "solid-js";

import { createEventListener } from "@solid-primitives/event-listener";
import { Menu, type MenuItem } from "@loong/ui";

import { KeyIcon } from "../../../assets/icons/KeyIcon";
import { LogoutIcon } from "../../../assets/icons/LogoutIcon";
import { SettingsIcon } from "../../../assets/icons/SettingsIcon";
import { UserIcon } from "../../../assets/icons/UserIcon";
import { useLoginContext } from "../../../context/LoginContext";
import { useLocaleContext } from "../../../context/LocaleContext";
import { useServerContext } from "../../../context/ServerContext";
import { useSideNavContext } from "../../../context/SideNavContext";
import { ChangePasswordDialog } from "../../user/ChangePasswordDialog";
import { ProfileDialog } from "../../user/ProfileDialog";

/** 左侧导航底部：用户菜单与设置入口。 */
export function SideNavFooter() {
  const {user, session, clearSession} = useLoginContext();
  const {t} = useLocaleContext();
  const {api_client_proxy} = useServerContext();
  const {setSettingsOpen} = useSideNavContext();
  const [userMenuOpen, setUserMenuOpen] = createSignal(false);
  const [profileOpen, setProfileOpen] = createSignal(false);
  const [passwordOpen, setPasswordOpen] = createSignal(false);
  let userMenu: HTMLDivElement | undefined;

  createEventListener(window, "pointerdown", (event) => {
    if (!userMenu?.contains(event.target as Node)) setUserMenuOpen(false);
  });

  const displayName = () =>
    user()?.name || user()?.username || t("user.guest", "未登录");
  const displayDescription = () =>
    user()?.name
      ? user()?.username ?? t("user.localDescription", "本地账户")
      : t("user.localDescription", "本地账户");
  const avatarText = () => displayName().trim().charAt(0).toUpperCase() || "U";

  const userMenuItems = (): MenuItem[] => [
    {
      key: "profile",
      label: t("user.menu.profile", "个人信息"),
      icon: <UserIcon class="h-3.5 w-3.5" />,
    },
    {
      key: "password",
      label: t("user.menu.password", "修改密码"),
      icon: <KeyIcon class="h-3.5 w-3.5" />,
    },
    {
      key: "logout",
      label: t("user.menu.logout", "退出"),
      icon: <LogoutIcon class="h-3.5 w-3.5" />,
      danger: true,
    },
  ];

  const logout = async () => {
    try {
      if (session()) {
        await api_client_proxy().auth.logout();
      }
    } catch {
      // 网关退出失败不阻塞本地会话清理。
    } finally {
      clearSession();
    }
  };

  const selectUserMenu = (key: string) => {
    setUserMenuOpen(false);
    if (key === "profile") setProfileOpen(true);
    if (key === "password") setPasswordOpen(true);
    if (key === "logout") void logout();
  };

  return (
    <>
  <footer class="flex min-w-[200px] shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 dark:border-slate-800">
      <div ref={userMenu} class="relative min-w-0">
        <button
          type="button"
          onClick={() => setUserMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen() ? "true" : "false"}
          class="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:hover:bg-slate-800"
        >
          <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-500 text-[11px] font-semibold uppercase text-white">
            {avatarText()}
          </span>
          <div class="grid min-w-0 gap-0.5">
            <span class="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200" title={displayName()}>
              {displayName()}
            </span>
            <span class="truncate text-[10px] text-slate-400 dark:text-slate-500" title={displayDescription()}>
              {displayDescription()}
            </span>
          </div>
        </button>

        <Show when={userMenuOpen()}>
          <Menu
            items={userMenuItems()}
            onSelect={selectUserMenu}
            class="absolute bottom-full left-0 z-50 mb-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          />
        </Show>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.blur();
          setSettingsOpen(true);
        }}
        aria-label={t("settings.open", "设置")}
        title={t("settings.open", "设置")}
        class="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <SettingsIcon class="h-4 w-4" />
      </button>
    </footer>

      <ProfileDialog open={profileOpen()} onOpenChange={setProfileOpen} />
      <ChangePasswordDialog open={passwordOpen()} onOpenChange={setPasswordOpen} />
    </>
  );
}
