import type { PreviewCase } from "../types";
import { chatCases } from "./chat";
import { iconCases } from "./icon";
import { layoutCases } from "./layout";
import { loginCases } from "./login";
import { modelPickerCases } from "./model-picker";
import { navCases } from "./nav";
import { serverConfigCases } from "./server-config";
import { settingsCases } from "./settings";

/**
 * 预览用例总表：新增组件时创建 `cases/<component>.tsx`，导出用例数组，
 * 再在这里并入即可；侧边栏按 `group` 自动分组。
 */
export const cases: PreviewCase[] = [
  ...loginCases,
  ...serverConfigCases,
  ...settingsCases,
  ...layoutCases,
  ...navCases,
  ...chatCases,
  ...modelPickerCases,
  ...iconCases,
];
