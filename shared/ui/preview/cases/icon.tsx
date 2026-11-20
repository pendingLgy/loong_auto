import { For } from "solid-js";

import {
  BackIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  CopyIcon,
  FlameIcon,
  HomeIcon,
  MoreIcon,
  NavItemIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  SlidersIcon,
  SpinnerIcon,
  StopIcon,
} from "../../src/icon";
import type { PreviewCase } from "../types";

const ICONS = [
  { name: "SendIcon", element: <SendIcon class="h-6 w-6" /> },
  { name: "StopIcon", element: <StopIcon class="h-6 w-6" /> },
  { name: "PlusIcon", element: <PlusIcon class="h-6 w-6" /> },
  { name: "CopyIcon", element: <CopyIcon class="h-6 w-6" /> },
  { name: "CheckIcon", element: <CheckIcon class="h-6 w-6" /> },
  { name: "SlidersIcon", element: <SlidersIcon class="h-6 w-6" /> },
  { name: "BackIcon", element: <BackIcon class="h-6 w-6" /> },
  { name: "SearchIcon", element: <SearchIcon class="h-6 w-6" /> },
  { name: "SettingsIcon", element: <SettingsIcon class="h-6 w-6" /> },
  { name: "ChevronIcon", element: <ChevronIcon expanded class="h-6 w-6" /> },
  { name: "SpinnerIcon", element: <SpinnerIcon class="h-6 w-6" /> },
  { name: "MoreIcon", element: <MoreIcon class="h-6 w-6" /> },
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
