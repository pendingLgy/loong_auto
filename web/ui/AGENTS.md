# ui 协作规范

作用于 `web/ui`，补充 [web/AGENTS.md](../AGENTS.md)。

## 组件

- 组件按类别放在 `src` 子目录，通过 `src/index.ts` 导出。
- 交互组件优先 Kobalte。
- 组件不得依赖 `web/app` 的 Context、页面状态或图标；通过 Props 注入文案、数据与回调。
- Props 变化时同步更新 `preview` 中的使用文档。
- 样式只使用 Tailwind 工具类；禁止 `<style>`、`style={...}` 与组件级 CSS。

## 预览

- 每个组件在 preview 左侧菜单默认提供「基础预览」场景与「使用文档」。
- 使用文档必须包含参数表，并提供至少一个可直接运行的基础用法示例。
- 复杂组件需补充受控用法、插槽或错误处理示例。
- 新增组件或修改 Props 后，同步更新预览场景、使用文档与 `src/index.ts` 导出。

## 开发

- `bun run dev:ui` 启动组件预览，修改 `src` 或 `preview` 时自动热更新。
- 应用通过 `@loong/ui` 源码消费组件；同时运行 `pnpm dev:web` 或 `bun run dev:web` 时，`src` 修改也会触发热更新。
- 预览服务固定端口 `5174`，Vite 使用轮询监听源码，避免 Windows 链接目录漏掉变更。

## 国际化

- UI 组件库通过 `UiI18nProvider` 提供 `en-US` 文案；中文由调用方通过 `t(key, fallback)` 的 fallback 提供。
- 组件内部默认文案使用 `useUiI18n().t(key, "中文默认值")`，外部仍可通过 `labels` 或文案 Props 覆盖。
- 业务应用可以继续通过 Props 注入自身国际化文案，不强制依赖 UI Provider。
- 新增组件默认文案时，在调用处提供中文 fallback，并补充 `src/i18n/en-US.ts` 的英文消息。
- 预览页右上角提供 `EN` / `中文` 切换，用于验证组件默认文案。

## 表单

- 字段使用纵向布局：标签在上，输入框在下，间距 `gap-1.5`。
- 输入框统一 `h-10`、`rounded-lg`、边框与 focus ring；不要用 placeholder 代替标签。
- 必填字段在标签右侧显示红色 `*`，星号使用 `aria-hidden="true"`，不进入无障碍名称。
- 必填状态使用 `aria-required="true"`，不使用原生 `required` 或浏览器默认必填样式。
- 必填与格式校验使用组件内自定义校验，`form` 加 `novalidate`，不依赖浏览器原生提示。
- 校验失败时输入框使用红色边框与红色 focus ring，并设置 `aria-invalid="true"`。
- 字段错误信息显示在对应输入框下方，使用 `text-[12px]` 红色文字与 `role="alert"`。
- 错误区域预留固定高度，错误出现或消失不得改变表单高度。
- 错误信息通过 `id` 与输入框的 `aria-describedby` 关联。
- 用户修改字段时清除该字段错误；提交时重新执行完整校验。
- 密码使用 `type="password"`，最少 8 位；注册时确认密码必须与密码一致。
- 提交期间禁用提交按钮并显示 loading，使用 `try/finally` 恢复状态。
- 非字段级错误显示在表单底部，不伪装成某个输入框的错误。
- 弹窗内表单固定内容区高度，列表或错误区域独立滚动，避免弹窗整体跳动。

## 验证

在仓库根目录执行：

```powershell
bun run --filter '@loong/ui' typecheck
bun run --filter '@loong/ui' build:preview
```
