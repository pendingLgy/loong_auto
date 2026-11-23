import { createSignal } from "solid-js";

import {
  WorkspaceCreate,
  WorkspaceSelect,
  type WorkspaceSelectItem,
} from "../../src/workspace-picker";
import type { PreviewCase } from "../types";

const workspaces: WorkspaceSelectItem[] = [
  { id: "workspace-1", name: "产品工作区" },
  { id: "workspace-2", name: "研发工作区" },
  { id: "workspace-3", name: "个人工作区" },
];

function WorkspaceSelectCase() {
  const [open, setOpen] = createSignal(true);
  const [createOpen, setCreateOpen] = createSignal(false);
  const [activeId, setActiveId] = createSignal("workspace-1");

  return (
    <div class="grid gap-3 p-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        class="w-fit rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500"
      >
        打开工作区选择
      </button>

      <WorkspaceSelect
        open={open()}
        workspaces={workspaces}
        activeWorkspaceId={activeId()}
        onSelect={(workspaceId) => {
          setActiveId(workspaceId);
          setOpen(false);
        }}
        onCreate={() => {
          setOpen(false);
          setCreateOpen(true);
        }}
        onClose={() => setOpen(false)}
      />

      <WorkspaceCreate
        open={createOpen()}
        onSubmit={async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          setCreateOpen(false);
        }}
        onPickDirectory={async () => "src"}
        onBack={() => {
          setCreateOpen(false);
          setOpen(true);
        }}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

function WorkspaceCreateCase() {
  const [open, setOpen] = createSignal(true);

  return (
    <div class="grid gap-3 p-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        class="w-fit rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500"
      >
        打开新建工作区
      </button>
      <WorkspaceCreate
        open={open()}
        onSubmit={async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          setOpen(false);
        }}
        onPickDirectory={async () => "src"}
        onBack={() => setOpen(false)}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

export const workspacePickerCases: PreviewCase[] = [
  {
    id: "workspace-select-default",
    group: "WorkspaceSelect",
    title: "默认",
    render: () => <WorkspaceSelectCase />,
  },
  {
    id: "workspace-create-default",
    group: "WorkspaceCreate",
    title: "新建工作区",
    render: () => <WorkspaceCreateCase />,
  },
];
