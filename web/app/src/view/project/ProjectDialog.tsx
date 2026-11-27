import type { WorkspaceDialogLabels, WorkspaceSaveData } from "@loong/ui";
import { WorkspaceDialog } from "@loong/ui";

import { useLocaleContext } from "../../context/LocaleContext";

export interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: WorkspaceSaveData;
  onInit?: (data: WorkspaceSaveData) => void;
  onCancel?: () => void;
  onSave?: (data: WorkspaceSaveData) => void | Promise<void>;
  error?: string;
}

/** 应用侧工作区弹窗，注入国际化文案。 */
export function ProjectDialog(props: ProjectDialogProps) {
  const {t} = useLocaleContext();

  const labels = (): Partial<WorkspaceDialogLabels> => ({
    title: t("project.title", "工作区"),
    description: t("project.description", "选择需要纳入当前项目的本地文件夹。"),
    close: t("project.close", "关闭"),
    nameLabel: t("project.nameLabel", "工作区名称"),
    namePlaceholder: t("project.namePlaceholder", "输入工作区名称"),
    selected: t("project.selected", "已选中工作区"),
    selectHint: t("project.selectHint", "浏览器仅提供文件夹名称，不暴露完整本地路径。"),
    choose: t("project.choose", "选择工作区"),
    empty: t("project.empty", "还没有选择工作区。"),
    duplicate: t("project.duplicate", "该工作区已存在。"),
    required: t("project.required", "路径不能为空。"),
    edit: t("project.edit", "编辑"),
    remove: t("project.remove", "移除"),
    pathLabel: t("project.pathLabel", "工作区路径"),
    cancel: t("project.cancel", "取消"),
    save: t("project.save", "保存"),
  });

  return (
    <WorkspaceDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      initialData={props.initialData}
      onInit={props.onInit}
      onCancel={props.onCancel}
      onSave={props.onSave}
      error={props.error}
      labels={labels()}
    />
  );
}
