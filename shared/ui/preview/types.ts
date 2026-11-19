import type { JSX } from "solid-js";

/** 一个可预览的组件用例。新增组件时在 preview/cases/ 下追加文件并导出用例数组。 */
export interface PreviewCase {
  /** 唯一标识，同时用作 URL hash，例如 login-default。 */
  id: string;
  /** 侧边栏分组，一般填组件名。 */
  group: string;
  /** 用例标题，展示在侧边栏与内容区顶部。 */
  title: string;
  render: () => JSX.Element;
}
