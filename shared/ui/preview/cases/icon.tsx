import { For } from "solid-js";

import {
  AlertIcon,
  BellIcon,
  BackIcon,
  CheckIcon,
  DangerIcon,
  ErrorIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  SuccessIcon,
  ChevronIcon,
  CloseIcon,
  CopyIcon,
  FlameIcon,
  HomeIcon,
  MoonIcon,
  MoreIcon,
  NavItemIcon,
  LogoutIcon,
  PanelCollapseIcon,
  PanelExpandIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  ServerIcon,
  SettingsIcon,
  SlidersIcon,
  SpinnerIcon,
  StopIcon,
  SunIcon,
  TrashIcon,
} from "../../src/icon";
import type { PreviewCase } from "../types";

const ICONS = [
  { name: "SendIcon", element: <SendIcon class="h-6 w-6" /> },
  { name: "StopIcon", element: <StopIcon class="h-6 w-6" /> },
  { name: "TrashIcon", element: <TrashIcon class="h-6 w-6" /> },
  { name: "LogoutIcon", element: <LogoutIcon class="h-6 w-6" /> },
  { name: "PanelCollapseIcon", element: <PanelCollapseIcon class="h-6 w-6" /> },
  { name: "PanelExpandIcon", element: <PanelExpandIcon class="h-6 w-6" /> },
  { name: "PinIcon", element: <PinIcon class="h-6 w-6" /> },
  { name: "PlusIcon", element: <PlusIcon class="h-6 w-6" /> },
  { name: "CopyIcon", element: <CopyIcon class="h-6 w-6" /> },
  { name: "CheckIcon", element: <CheckIcon class="h-6 w-6" /> },
  { name: "SlidersIcon", element: <SlidersIcon class="h-6 w-6" /> },
  { name: "AlertIcon", element: <AlertIcon class="h-6 w-6" /> },
  { name: "BellIcon", element: <BellIcon class="h-6 w-6" /> },
  { name: "DangerIcon", element: <DangerIcon class="h-6 w-6" /> },
  { name: "InfoIcon", element: <InfoIcon class="h-6 w-6" /> },
  { name: "SuccessIcon", element: <SuccessIcon class="h-6 w-6" /> },
  { name: "EyeIcon", element: <EyeIcon class="h-6 w-6" /> },
  { name: "EyeOffIcon", element: <EyeOffIcon class="h-6 w-6" /> },
  { name: "ErrorIcon", element: <ErrorIcon class="h-6 w-6" /> },
  { name: "BackIcon", element: <BackIcon class="h-6 w-6" /> },
  { name: "SearchIcon", element: <SearchIcon class="h-6 w-6" /> },
  { name: "ServerIcon", element: <ServerIcon class="h-6 w-6" /> },
  { name: "SettingsIcon", element: <SettingsIcon class="h-6 w-6" /> },
  { name: "ChevronIcon", element: <ChevronIcon expanded class="h-6 w-6" /> },
  { name: "SpinnerIcon", element: <SpinnerIcon class="h-6 w-6" /> },
  { name: "MoonIcon", element: <MoonIcon class="h-6 w-6" /> },
  { name: "MoreIcon", element: <MoreIcon class="h-6 w-6" /> },
  { name: "SunIcon", element: <SunIcon class="h-6 w-6" /> },
  { name: "FlameIcon", element: <FlameIcon class="h-6 w-6" /> },
  { name: "HomeIcon", element: <HomeIcon class="h-6 w-6" /> },
  { name: "CloseIcon", element: <CloseIcon class="h-6 w-6" /> },
  { name: "NavItemIcon（newChat）", element: <NavItemIcon name="newChat" class="h-6 w-6" /> },
  { name: "NavItemIcon（automation）", element: <NavItemIcon name="automation" class="h-6 w-6" /> },
];

export const iconCases: PreviewCase[] = [
  {
    id: "icon-gallery",
    group: "Icon",
    title: "图标一览",
    render: () => (
      <div class="grid grid-cols-3 gap-3 p-4 md:grid-cols-5">
        <For each={ICONS}>
          {(icon) => (
            <div class="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 dark:border-white/10">
              <span class="grid h-8 place-items-center text-slate-600 dark:text-slate-300">
                {icon.element}
              </span>
              <span class="text-center text-[11px] text-slate-400 dark:text-slate-500">
                {icon.name}
              </span>
            </div>
          )}
        </For>
      </div>
    ),
  },
];
