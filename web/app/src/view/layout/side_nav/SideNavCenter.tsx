import { Show, createEffect, createSignal, onSettled } from "solid-js";

import { Menu, type MenuItem, type WorkspaceSaveData } from "@loong/ui";
import type { WorkspaceResponse } from "@loong/web-api";

import { MoreIcon } from "../../../assets/icons/MoreIcon";
import { PlusIcon } from "../../../assets/icons/PlusIcon";
import { useLocaleContext } from "../../../context/LocaleContext";
import { useLoginContext } from "../../../context/LoginContext";
import { useServerContext } from "../../../context/ServerContext";
import { useSideNavContext } from "../../../context/SideNavContext";
import { ProjectDialog } from "../../project/ProjectDialog";

/** 左侧导航中间区域：新对话、工作区与扩展内容。 */
export function SideNavCenter() {
  const {t} = useLocaleContext();
  const {api_client_proxy} = useServerContext();
  const {session} = useLoginContext();
  const {left, onNewConversation} = useSideNavContext();
  const [workspaceValue, setWorkspaceValue] = createSignal("");
  const [workspaces, setWorkspaces] = createSignal<WorkspaceResponse[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = createSignal(false);
  const [workspaceError, setWorkspaceError] = createSignal<string | null>(null);
  const [projectOpen, setProjectOpen] = createSignal(false);

  const workspaceItems = (): MenuItem[] => workspaces().map((workspace) => ({
    key: workspace.id,
    label: workspace.name?.trim() || workspace.path[0] || workspace.id,
  }));


  
  const loadWorkspaces = async () => {
    if (!session()) {
      setWorkspaces([]);
      setWorkspaceValue("");
      return;
    }
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const result = await api_client_proxy().workspace.list({page: 1, page_size: 100});
      const rows = result.rows ?? [];
      setWorkspaces(rows);
      setWorkspaceValue((current) => rows.some((workspace) => workspace.id === current)
        ? current
        : rows[0]?.id ?? "");
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setWorkspaceLoading(false);
    }
  };

  let mounted = false;
  let firstSessionEffect = true;

  onSettled(() => {
    mounted = true;
    if (session()) void loadWorkspaces();
  });

  createEffect(
    () => session(),
    (value) => {
      const initial = firstSessionEffect;
      firstSessionEffect = false;
      if (initial || !mounted) return;
      if (!value) {
        setWorkspaces([]);
        setWorkspaceValue("");
        setWorkspaceError(null);
        return;
      }
      void loadWorkspaces();
    },
  );

  const saveWorkspace = async (data: WorkspaceSaveData) => {
    const created = await api_client_proxy().workspace.create({
      name: data.name,
      path: data.paths,
    });
    await loadWorkspaces();
    setWorkspaceValue(created.id);
  };

  return (
    <>
    <div class="flex min-h-0 min-w-[200px] flex-1 flex-col gap-4 overflow-auto p-4">
      <button
        type="button"
        onClick={onNewConversation}
        class="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-[13px] font-medium text-indigo-600 outline-none transition hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
      >
        <span class="text-base leading-none" aria-hidden="true">+</span>
        {t("chat.newConversation", "新对话")}
      </button>

      <div class="shrink-0 border-t border-slate-200 dark:border-slate-800" />

      <div class="flex h-7 shrink-0 items-center justify-between px-1 text-[12px] font-medium uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span>{t("workspace.title", "工作区")}</span>
        <div class="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={t("workspace.more", "更多")}
            title={t("workspace.more", "更多")}
            class="grid h-6 w-6 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <MoreIcon class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.blur();
              setProjectOpen(true);
            }}
            aria-label={t("workspace.add", "新建工作区")}
            title={t("workspace.add", "新建工作区")}
            class="grid h-6 w-6 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <PlusIcon class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <Show when={workspaceLoading()}>
        <p class="m-0 px-2 text-[12px] text-slate-400 dark:text-slate-500">
          {t("workspace.loading", "加载中…")}
        </p>
      </Show>
      <Show when={!workspaceLoading()}>
        <Menu
          items={workspaceItems()}
          value={workspaceValue()}
          onSelect={setWorkspaceValue}
        />
      </Show>
      <Show when={!workspaceLoading() && !workspaceError() && workspaces().length === 0}>
        <p class="m-0 px-2 text-[12px] text-slate-400 dark:text-slate-500">
          {t("workspace.empty", "暂无工作区")}
        </p>
      </Show>
      <Show when={workspaceError()}>
        <p role="alert" class="m-0 px-2 text-[12px] text-red-600 dark:text-red-400">
          {workspaceError()}
        </p>
      </Show>
      {left()}
    </div>

      <ProjectDialog
        open={projectOpen()}
        onOpenChange={setProjectOpen}
        onSave={saveWorkspace}
      />
    </>
  );
}
