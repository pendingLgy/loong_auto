import { For, Show, createEffect, createSignal, type Component } from "solid-js";

import { Dialog } from "../dialog";
import { EditIcon, PlusIcon, TrashIcon } from "../icon";
import { DEFAULT_LOCALE, translate, type Locale } from "../i18n";

/** 新建工作区提交数据。 */
export interface WorkspaceCreateInput {
  name: string;
  path: string[];
}

export interface WorkspaceCreateProps {
  /** 是否打开弹窗。 */
  open: boolean;
  /** 界面语言；默认中文。 */
  locale?: Locale;
  /** 返回选择工作区。 */
  onBack?: () => void;
  /** 关闭弹窗。 */
  onClose?: () => void;
  /** 提交创建；抛错时在表单中展示。 */
  onSubmit: (input: WorkspaceCreateInput) => Promise<void>;
  /** 选择工作目录，返回目录路径。 */
  onPickDirectory?: () => Promise<string | null>;
}

/** 新建工作区弹窗：名称 + 多个工作目录。 */
export const WorkspaceCreate: Component<WorkspaceCreateProps> = (props) => {
  const locale = () => props.locale ?? DEFAULT_LOCALE;
  const [name, setName] = createSignal("");
  const [directories, setDirectories] = createSignal<string[]>([]);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [editingPath, setEditingPath] = createSignal("");
  const [editingError, setEditingError] = createSignal("");

  createEffect(() => {
    if (!props.open) return;
    setName("");
    setDirectories([]);
    setError("");
    setEditingIndex(null);
    setEditingPath("");
    setEditingError("");
  });

  const folderName = (path: string) => {
    const parts = path.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? path;
  };

  const addDirectory = (path: string) => {
    const value = path.trim();
    if (!value) return;
    const first = directories().length === 0;
    setDirectories((current) =>
      current.includes(value) ? current : [...current, value]);
    if (first && !name().trim()) {
      setName(folderName(value));
    }
    setError("");
  };

  const pickDirectory = async () => {
    if (!props.onPickDirectory) {
      setError(translate(locale(), "workspaceCreate.pickerUnavailable",
        "当前环境不支持文件夹选择，请手动输入目录路径"));
      return;
    }
    try {
      const path = await props.onPickDirectory();
      if (path) addDirectory(path);
    } catch {
      setError(translate(locale(), "workspaceCreate.pickerFailed", "选择文件夹失败"));
    }
  };

  const commitEditing = (index: number) => {
    const value = editingPath().trim();
    if (!value) {
      setEditingError("目录不能为空");
      return;
    }
    setDirectories((current) =>
      current.map((item, itemIndex) => itemIndex === index ? value : item));
    setEditingIndex(null);
    setEditingError("");
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const workspaceName = name().trim();
    if (!workspaceName) {
      setError(translate(locale(), "workspaceCreate.nameRequired", "请输入工作区名称"));
      return;
    }
    const paths = directories().map((path) => path.trim()).filter(Boolean);
    if (paths.length === 0) {
      setError(translate(locale(), "workspaceCreate.directoryRequired", "请至少添加一个工作目录"));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await props.onSubmit({name: workspaceName, path: paths});
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : translate(locale(), "workspaceCreate.failed", "创建工作区失败"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={props.open}
      onClose={() => props.onClose?.()}
      size="sm"
      header={
        <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
          {translate(locale(), "workspaceCreate.title", "新建工作区")}
        </h2>
      }
    >
      <form
        onSubmit={(event) => void submit(event)}
        aria-busy={submitting()}
        novalidate
        class="grid gap-[18px]"
      >
        <div class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">
            {translate(locale(), "workspaceCreate.name", "工作区名称")}
          </span>
          <input
            value={name()}
            onInput={(event) => {
              setName(event.currentTarget.value);
              setError("");
            }}
            name="workspace-name"
            autocomplete="off"
            spellcheck={false}
            disabled={submitting()}
            placeholder={translate(locale(), "workspaceCreate.namePlaceholder",
              "例如：产品工作区")}
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100"
          />
        </div>

        <div class="grid gap-2">
          <button
            type="button"
            onClick={() => void pickDirectory()}
            disabled={submitting()}
            class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 outline-none transition hover:border-sky-400 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-60 dark:border-white/15 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:bg-sky-500/10"
          >
            <PlusIcon class="h-4 w-4" />
            {translate(locale(), "workspaceCreate.select", "选择目录")}
          </button>

          <Show
            when={directories().length > 0}
            fallback={
              <p class="m-0 rounded-xl border border-slate-200 px-3 py-3 text-center text-[13px] text-slate-400 dark:border-white/10 dark:text-slate-500">
                {translate(locale(), "workspaceCreate.emptyDirectories", "尚未选择目录")}
              </p>
            }
          >
            <ul class="m-0 grid w-full min-w-0 list-none gap-1.5 p-0">
              <For each={directories()}>
                {(path, index) => (
                  <li class="grid w-full min-w-0 gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <div class="flex min-w-0 items-center gap-2">
                      <Show
                        when={editingIndex() === index()}
                        fallback={
                          <>
                            <span
                              title={path}
                              class="min-w-0 max-w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-700 dark:text-slate-200"
                            >
                              {path}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingIndex(index());
                                setEditingPath(path);
                                setEditingError("");
                                setError("");
                              }}
                              disabled={submitting()}
                              aria-label={translate(locale(), "workspaceCreate.editDirectory",
                                "编辑工作区 {{ path }}", {path})}
                              title={translate(locale(), "workspaceCreate.edit", "编辑工作区")}
                              class="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-slate-900/10 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-60 dark:hover:bg-white/10 dark:hover:text-slate-200"
                            >
                              <EditIcon class="h-3.5 w-3.5" />
                            </button>
                          </>
                        }
                      >
                        <input
                          value={editingPath()}
                          onInput={(event) => {
                            setEditingPath(event.currentTarget.value);
                            setEditingError("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitEditing(index());
                            } else if (event.key === "Escape") {
                              setEditingIndex(null);
                              setEditingError("");
                            }
                          }}
                          onBlur={() => {
                            if (editingIndex() === index()) commitEditing(index());
                          }}
                          disabled={submitting()}
                          autofocus
                          aria-invalid={!!editingError()}
                          aria-label={translate(locale(), "workspaceCreate.editDirectory",
                            "编辑工作区 {{ path }}", {path})}
                          class="min-w-0 max-w-full flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60 aria-invalid:border-red-500 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-200"
                        />
                      </Show>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingIndex() === index()) setEditingIndex(null);
                          setEditingError("");
                          setDirectories((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index()));
                        }}
                        disabled={submitting()}
                        aria-label={translate(locale(), "workspaceCreate.removeDirectory",
                          "移除工作区 {{ path }}", {path})}
                        title={translate(locale(), "workspaceCreate.remove", "移除工作区")}
                        class="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 outline-none transition hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-60 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      >
                        <TrashIcon class="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Show when={editingIndex() === index() && editingError()}>
                      <p
                        role="alert"
                        class="m-0 text-[12px] font-medium text-red-600 dark:text-red-400"
                      >
                        {editingError()}
                      </p>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>

        <Show when={error()}>
          <p
            role="alert"
            aria-live="assertive"
            class="m-0 text-[13px] font-medium text-red-600 dark:text-red-400"
          >
            {error()}
          </p>
        </Show>

        <div class="flex justify-end gap-2">
          <Show when={props.onBack}>
            <button
              type="button"
              onClick={() => props.onBack?.()}
              disabled={submitting()}
              class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-900/5 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              {translate(locale(), "workspaceCreate.back", "返回")}
            </button>
          </Show>
          <button
            type="submit"
            disabled={submitting()}
            class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white outline-none transition hover:from-sky-400 hover:to-blue-500 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-progress disabled:opacity-70"
          >
            {submitting()
              ? translate(locale(), "workspaceCreate.submitting", "创建中…")
              : translate(locale(), "workspaceCreate.confirm", "确认")}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
