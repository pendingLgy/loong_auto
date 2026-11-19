# shared/ui

Web 与 Electron 共用的 SolidJS DOM 组件。

## 目录

目录树、组件放置与文件命名约定见 [STRUCTURE.md](STRUCTURE.md)。

## 检查组件效果

### 方式一：在 Web 应用里看真实效果

```powershell
bun install          # 仓库根
bun run dev:web      # http://127.0.0.1:5173
```

这是接入本地网关的真实链路，需要先启动 local（`http://127.0.0.1:9528`）。

### 方式二：组件预览（不依赖网关）

```powershell
bun run --filter '@loong/ui' preview   # http://127.0.0.1:5174
```

预览是一个组件画廊：左侧导航按组件分组列出用例，右侧渲染当前用例，导航区可独立滚动并支持搜索；分组默认折叠，点击组件名展开，搜索时自动展开命中的分组。地址栏 hash 可直达（如 `#login-error`），选中用例时会展开所在分组。预览右上角可切换浅色/深色：首次进入跟随系统偏好，选择写入 `localStorage`（`loong-ui-preview-theme`）；预览用 `.dark` class 控制 `dark:` 变体，消费端（Web/Electron）仍跟随系统偏好。预览服务器以 `shared/ui` 为 Vite root，修改 `src/` 或 `preview/` 会直接热更新（Solid HMR），无需刷新页面。内置 LoginPage 用例：

- 中文（默认）：不传文案与 locale，使用 `zh-CN` 字典；
- 英文（locale=en-US）：传入 `locale="en-US"`；
- 登录失败：`onSubmit` 抛错，展示错误文案；
- 慢速提交：3 秒延迟，观察提交中的禁用态与 `aria-busy`。

ThreePaneLayout 用例：

- 默认布局：高度为当前窗口高度（`100vh`），最小高度默认 480px；中栏顶部导航栏两端是折叠按钮，左右分隔条可拖动，`onChange` 返回最新 `LayoutState`；
- 恢复上次宽度：通过 `value` 传入已保存的 `leftWidth` / `rightWidth`；
- 两侧已折叠：通过 `value` 恢复 `leftCollapsed` / `rightCollapsed`；
- 英文（locale=en-US）。

ServerConfigPage 用例：

- 中文（默认）：空表单，校验服务器地址与 Token；
- 带初始值：`initialValue` 预填地址与 Token；
- 保存失败：`onSubmit` 抛错，展示红色错误；
- 慢速保存：3 秒延迟，观察保存中状态；
- 英文（locale=en-US）。

新增组件用例：

1. 在 `preview/cases/<component>.tsx` 中导出 `PreviewCase[]`（`id` / `group` / `title` / `render`，类型见 `preview/types.ts`）；
2. 在 `preview/cases/index.ts` 的 `cases` 数组中并入。

侧边栏按 `group` 自动分组，`id` 会写入地址栏 hash，刷新或分享链接可直达具体用例。

## 消费方式

```ts
import { LoginPage } from "@loong/ui/login";
import { ServerConfigPage } from "@loong/ui/server-config";
import { ThreePaneLayout, type LayoutState } from "@loong/ui/layout";
import { loginWithLocalGateway } from "@loong/client/login";
import { TaskStatus, TaskTimeline } from "@loong/ui/task";
```

`LoginPage` / `ServerConfigPage` 只负责输入、校验展示、提交与错误展示：可见文案通过 `@loong/ui/i18n` 的 `translate(locale, key, fallback)` 获取（中文以 fallback 形式内联在组件里，默认 `zh-CN`；英文等其它语言维护在字典中），校验规则与登录实现（`onSubmit`）由消费端注入，不包含网关地址、平台或会话类型。网关登录实现位于 `@loong/client/login`。

依赖版本由仓库根 `package.json` 的 `workspaces.catalog` 统一管理；组件以 TS 源码形式提供，由消费端（Web 的 Vite、Electron 的 electron-vite）用 Solid 插件编译。

组件样式使用 Tailwind CSS v4 工具类，共享包本身不引入全局 CSS。消费端需要：

```css
@import "tailwindcss";
/* 让 Tailwind 扫描共享组件源码 */
@source "../../shared/ui/src";
```

Web 端的样式入口是 `web/src/styles.css`，预览端的样式入口是 `shared/ui/preview/styles.css`，两者都通过 `@tailwindcss/vite` 接入。
