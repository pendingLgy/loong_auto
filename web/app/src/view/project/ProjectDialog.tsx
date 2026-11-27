import { Show } from "solid-js";
import type { WorkspaceDialogController, WorkspaceSaveData } from "@loong/ui";
import { WorkspaceDialog } from "@loong/ui";


export interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: WorkspaceSaveData;
  onInit?: (data: WorkspaceSaveData) => void;
  onCancel?: () => void;
  onSave?: (data: WorkspaceSaveData) => void | Promise<void>;
  nameMaxLength?: number;
  ref?: (controller: WorkspaceDialogController) => void;
}

/** 应用侧工作区弹窗。 */
export function ProjectDialog(props: ProjectDialogProps) {
  return (
    <Show when={props.open}>
      <WorkspaceDialog
        open
        onOpenChange={(open) => {
          if (!open) props.onOpenChange(false);
        }}
        initialData={props.initialData}
        onInit={props.onInit}
        onCancel={props.onCancel}
        onSave={props.onSave}
        nameMaxLength={props.nameMaxLength}
        ref={props.ref}
      />
    </Show>
  );
}
