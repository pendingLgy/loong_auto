import {createEffect, createMemo, createSignal, For, Show} from "solid-js";
import {Dialog} from "@kobalte/core/dialog";


interface WorkspaceEntry {
  id: string;
  path: string;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<{ name: string }>;
}

function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(reason: unknown): string {
  if (typeof reason === "string") return reason;
  if (reason && typeof reason === "object" && "message" in reason) {
    const message = (reason as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return String(reason);
}

export interface WorkspaceSaveData {
  name: string;
  paths: string[];
}

export interface WorkspaceDialogLabels {
  title: string;
  description: string;
  close: string;
  nameLabel: string;
  namePlaceholder: string;
  nameRequired: string;
  nameMax: string;
  selected: string;
  workspaceRequired: string;
  selectHint: string;
  choose: string;
  empty: string;
  duplicate: string;
  required: string;
  edit: string;
  remove: string;
  pathLabel: string;
  cancel: string;
  save: string;
  saving: string;
}

const DEFAULT_LABELS: WorkspaceDialogLabels = {
  title: "工作区",
  description: "选择需要纳入当前项目的本地文件夹。",
  close: "关闭",
  nameLabel: "工作区名称",
  namePlaceholder: "输入工作区名称",
  nameRequired: "请输入工作区名称",
  nameMax: "工作区名称不能超过 {max} 个字符",
  selected: "已选中工作区",
  workspaceRequired: "请至少选择一个工作区",
  selectHint: "浏览器仅提供文件夹名称，不暴露完整本地路径。",
  choose: "选择工作区",
  empty: "还没有选择工作区。",
  duplicate: "该工作区已存在。",
  required: "路径不能为空。",
  edit: "编辑",
  remove: "移除",
  pathLabel: "工作区路径",
  cancel: "取消",
  save: "保存",
  saving: "保存中…",
};

export interface WorkspaceDialogController {
  cleanError: () => void;
}

export interface WorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 打开时用于初始化表单的数据。 */
  initialData?: WorkspaceSaveData;
  /** 表单初始化完成后触发。 */
  onInit?: (data: WorkspaceSaveData) => void;
  /** 点击取消或关闭时触发。 */
  onCancel?: () => void;
  /** 点击保存时触发。 */
  /** 返回 false 时保持弹窗打开，便于调用方自行处理失败。 */
  onSave?: (data: WorkspaceSaveData) => boolean | void | Promise<boolean | void>;
  /** 工作区名称最大长度，默认 30。 */
  nameMaxLength?: number;
  /** 获取组件控制器，用于手动清理错误。 */
  ref?: (controller: WorkspaceDialogController) => void;
  labels?: Partial<WorkspaceDialogLabels>;
}


function PlusIcon(props: { class?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
         stroke-linecap="round" aria-hidden="true" class={props.class}>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}

function TrashIcon(props: { class?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={props.class}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>
  );
}

/** 工作区弹窗：命名、选择目录与维护已选工作区。 */
export function WorkspaceDialog(props: WorkspaceDialogProps) {
  const labels = createMemo<WorkspaceDialogLabels>(() => ({
    ...DEFAULT_LABELS,
    ...props.labels,
  }));
  const [name, setName] = createSignal("");
  const [workspaces, setWorkspaces] = createSignal<WorkspaceEntry[]>([]);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [draftPath, setDraftPath] = createSignal("");
  const [formError, setFormError] = createSignal<string | null>(null);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [nameError, setNameError] = createSignal<string | null>(null);
  const nameMaxLength = () => props.nameMaxLength ?? 30;
  const [selectedError, setSelectedError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  let folderInput: HTMLInputElement | undefined;

  createEffect(
    () => props.open,
    (open) => {
      if (!open) return;
      const data = props.initialData;
      const nextName = data?.name ?? "";
      const nextPaths = data?.paths ?? [];
      setName(nextName);
      setWorkspaces(nextPaths.map((path) => ({id: newId(), path})));
      setEditingId(null);
      setDraftPath("");
      setFormError(null);
      setSaveError(null);
      props.onInit?.({name: nextName, paths: [...nextPaths]});
    },
  );

  const addWorkspace = (path: string) => {
    if (workspaces().some((workspace) => workspace.path === path)) {
      setFormError(labels().duplicate);
      return;
    }
    setWorkspaces((current) => [...current, {id: newId(), path}]);
    setSelectedError(null);
    if (!name().trim()) {
      const folderName = path.split(/[\\/]/).filter(Boolean).pop();
      if (folderName) setName(folderName);
    }
    setFormError(null);
  };

  const chooseWorkspace = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (picker) {
      try {
        const handle = await picker();
        addWorkspace(handle.name);
        return;
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
      }
    }
    folderInput?.click();
  };

  const onFolderInput = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    const root = file?.webkitRelativePath.split("/")[0];
    if (root) addWorkspace(root);
    input.value = "";
  };

  const startEdit = (workspace: WorkspaceEntry) => {
    setEditingId(workspace.id);
    setDraftPath(workspace.path);
    setFormError(null);
  };

  const saveEdit = () => {
    const id = editingId();
    const nextPath = draftPath().trim();
    if (!id) return;
    if (!nextPath) {
      setFormError(labels().required);
      return;
    }
    if (workspaces().some((workspace) =>
      workspace.id !== id && workspace.path === nextPath)) {
      setFormError(labels().duplicate);
      return;
    }
    setWorkspaces((current) => current.map((workspace) =>
      workspace.id === id ? {...workspace, path: nextPath} : workspace));
    setEditingId(null);
    setFormError(null);
  };

  const removeWorkspace = (id: string) => {
    setWorkspaces((current) => current.filter((workspace) => workspace.id !== id));
    if (editingId() === id) setEditingId(null);
  };

  const saveProject = async () => {
    setSaveError(null);
    setFormError(null);
    setNameError(null);
    setSelectedError(null);
    if (!name().trim()) {
      setNameError(labels().nameRequired);
      return;
    }
    if (name().trim().length > nameMaxLength()) {
      setNameError(labels().nameMax.replace("{max}", String(nameMaxLength())));
      return;
    }
    if (workspaces().length === 0) {
      setSelectedError(labels().workspaceRequired);
      return;
    }
    setSaving(true);
    try {
      const shouldClose = await props.onSave?.({
        name: name().trim(),
        paths: workspaces().map((workspace) => workspace.path),
      });
      if (shouldClose !== false) props.onOpenChange(false);
    } catch (reason) {
      setSaveError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const displayError = () => saveError() || formError();

  const cancel = () => {
    props.onCancel?.();
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-sm"/>
        <Dialog.Content
          class="fixed left-1/2 top-1/2 z-[70] flex h-[560px] max-h-[85vh] w-[600px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
          <div
            class="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-5 overflow-hidden p-5">
            <header class="flex items-start justify-between gap-3">
              <div class="grid gap-1">
                <Dialog.Title class="m-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {labels().title}
                </Dialog.Title>
                <Dialog.Description class="m-0 text-[13px] text-slate-500 dark:text-slate-400">
                  {labels().description}
                </Dialog.Description>
              </div>
              <Dialog.CloseButton
                onClick={() => props.onCancel?.()}
                aria-label={labels().close}
                title={labels().close}
                class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                ✕
              </Dialog.CloseButton>
            </header>

            <div class="grid gap-1.5">
              <label for="workspace-name"
                     class="flex items-center gap-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                {labels().nameLabel}
                <span class="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="workspace-name"
                value={name()}
                onInput={(event) => {
                  setName(event.currentTarget.value);
                  setNameError(null);
                }}
                placeholder={labels().namePlaceholder}
                maxlength={nameMaxLength()}
                aria-required="true"
                aria-invalid={nameError() ? "true" : "false"}
                aria-describedby={nameError() ? "workspace-name-error" : undefined}
                class={`h-10 rounded-lg border bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:ring-2 dark:bg-slate-950 dark:text-slate-200 ${
                  nameError()
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500"
                    : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-slate-700"
                }`}
              />
              <div class="min-h-4">
                <Show when={nameError()}>
                  <p id="workspace-name-error" role="alert"
                     class="m-0 text-[12px] text-red-600 dark:text-red-400">
                    {nameError()}
                  </p>
                </Show>
              </div>
            </div>

            <div class="flex min-h-0 flex-col gap-3">
              <div class="flex items-start justify-between gap-3">
                <div class="grid gap-1">
                  <div class="flex items-center gap-2">
                    <h2
                      class="m-0 flex items-center gap-1 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                      {labels().selected}
                      <span class="text-red-500" aria-hidden="true">*</span>
                    </h2>
                    <span
                      class="rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {workspaces().length}
              </span>
                  </div>
                  <p class="m-0 text-[12px] text-slate-500 dark:text-slate-400">
                    {labels().selectHint}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void chooseWorkspace()}
                  class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-[13px] font-medium text-indigo-600 outline-none transition hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                >
                  <PlusIcon class="h-3.5 w-3.5"/>
                  {labels().choose}
                </button>
              </div>

              <div class="min-h-4">
                <Show when={selectedError()}>
                  <p id="workspace-selected-error" role="alert"
                     class="m-0 text-[12px] text-red-600 dark:text-red-400">
                    {selectedError()}
                  </p>
                </Show>
              </div>

              <input
                ref={(element) => {
                  folderInput = element;
                  element.setAttribute("webkitdirectory", "");
                  element.setAttribute("directory", "");
                }}
                type="file"
                multiple
                class="hidden"
                onChange={onFolderInput}
              />

              <Show when={workspaces().length === 0}>
                <p
                  class="m-0 rounded-lg border border-dashed border-slate-300 p-3 text-[12px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  {labels().empty}
                </p>
              </Show>

              <div
                class={`grid auto-rows-[40px] gap-[5px] overflow-y-auto pr-1 ${workspaces().length ? "h-52" : ""}`}>
                <For each={workspaces()}>
                  {(workspace) => (
                    <div
                      class="flex h-10 min-w-0 items-center rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
                      <Show
                        when={editingId() === workspace.id}
                        fallback={(
                          <div class="flex w-full min-w-0 items-center justify-between gap-3">
                      <span
                        class="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-slate-700 dark:text-slate-200"
                        title={workspace.path}>
                        {workspace.path}
                      </span>
                            <div class="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(workspace)}
                                class="rounded-md px-2 py-1 text-[12px] text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              >
                                {labels().edit}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeWorkspace(workspace.id)}
                                aria-label={labels().remove}
                                title={labels().remove}
                                class="grid h-7 w-7 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                              >
                                <TrashIcon class="h-3.5 w-3.5"/>
                              </button>
                            </div>
                          </div>
                        )}
                      >
                        <div class="flex w-full items-center gap-2">
                          <input
                            value={draftPath()}
                            onInput={(event) => setDraftPath(event.currentTarget.value)}
                            aria-label={labels().pathLabel}
                            class="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                          />
                          <div class="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              class="rounded-md border border-slate-300 px-2 py-1 text-[12px] text-slate-600 outline-none transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {labels().cancel}
                            </button>
                            <button
                              type="button"
                              onClick={saveEdit}
                              class="rounded-md bg-indigo-500 px-2 py-1 text-[12px] font-medium text-white outline-none transition hover:bg-indigo-600"
                            >
                              {labels().save}
                            </button>
                          </div>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>

          <Show when={displayError()}>
            <p role="alert" class="shrink-0 px-5 pb-2 text-[12px] text-red-600 dark:text-red-400">
              {displayError()}
            </p>
          </Show>

          <footer
            class="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
            <button
              type="button"
              onClick={cancel}
              class="h-9 rounded-lg border border-slate-300 px-3 text-[13px] font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {labels().cancel}
            </button>
            <button
              type="button"
              onClick={() => void saveProject()}
              disabled={saving()}
              class="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-[13px] font-medium text-white outline-none transition hover:bg-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Show when={saving()}>
                <span
                  class="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"/>
              </Show>
              {saving() ? labels().saving : labels().save}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
