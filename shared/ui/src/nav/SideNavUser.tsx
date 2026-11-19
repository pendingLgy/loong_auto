import { type Component, type JSX } from "solid-js";

import { SettingsIcon } from "../icon";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

/** 底部用户信息。 */
export interface SideNavUserData {
  /** 显示名称；为空时回退到用户名或「未登录」。 */
  name?: string;
  /** 用户名 / 邮箱，作为次要文本。 */
  username?: string;
  /** 头像地址；没有时用名称首字生成文字头像。 */
  avatarUrl?: string;
}

export interface SideNavUserProps {
  /** 界面语言；默认中文。 */
  locale?: Locale;
  user?: SideNavUserData;
  /** 点击用户信息区域。 */
  onClick?: () => void;
  /** 点击右侧设置按钮。 */
  onSettings?: () => void;
  class?: string;
}

function Initials(props: { text: string }): JSX.Element {
  return (
    <span
      class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-linear-to-br from-sky-500 to-blue-600 text-[11px] font-semibold text-white"
      aria-hidden="true"
    >
      {props.text.slice(0, 1).toUpperCase()}
    </span>
  );
}


/** 底部固定的用户头像 + 名称操作栏；左侧可打开用户菜单，右侧为设置入口。 */
export const SideNavUser: Component<SideNavUserProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;

  const displayName = () =>
    props.user?.name?.trim()
    || props.user?.username?.trim()
    || translate(locale(), "nav.userFallback", "未登录");

  const secondary = () => {
    const username = props.user?.username?.trim();
    return username && username !== displayName() ? username : "";
  };

  return (
    <div class={`shrink-0 border-t border-slate-200 bg-slate-50/80 p-2 dark:border-white/10 dark:bg-slate-900/60 ${props.class ?? ""}`}>
      <div class="flex h-10 items-center gap-1 rounded-lg px-1 transition hover:bg-slate-900/5 dark:hover:bg-white/5">
        <button
          type="button"
          onClick={() => props.onClick?.()}
          aria-label={translate(locale(), "nav.userMenu", "用户菜单")}
          title={translate(locale(), "nav.userMenu", "用户菜单")}
          class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
        >
          {props.user?.avatarUrl
            ? <img src={props.user.avatarUrl} alt="" class="h-7 w-7 shrink-0 rounded-full object-cover" />
            : <Initials text={displayName()} />}
          <span class="grid min-w-0 flex-1">
            <span class="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
              {displayName()}
            </span>
            {secondary()
              ? <span class="truncate text-[10px] text-slate-500 dark:text-slate-400">{secondary()}</span>
              : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => props.onSettings?.()}
          aria-label={translate(locale(), "nav.settings", "设置")}
          title={translate(locale(), "nav.settings", "设置")}
          class="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 outline-none transition hover:bg-slate-900/10 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
};
