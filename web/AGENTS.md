# web 协作规范

本文作用于 `web/`，补充根目录 [AGENTS.md](../AGENTS.md)。

## 职责边界

- `web` 是 **SolidJS + Vite** 的浏览器界面，只通过本地网关访问后端；禁止直连云端业务接口。
- 界面组件优先复用 `@loong/ui`，网关调用统一走 `@loong/client`；不在页面里直接写 `fetch`。
- Electron 复用本目录的 DOM 组件与页面思路，但桌面宿主逻辑放在 `desktop/`，不要塞进 `web`。
- 不在这里实现工具执行、权限审批或云端编排，这些属于 `local` / `cloud`。

## 目录约定

目录树见 [BUILD.md](BUILD.md)。核心约定：

- `src/main.tsx` 只负责挂载，`src/App.tsx` 只渲染 `<AppRouter />`。
- 路由表与守卫只放在 `src/routers/`：`routes.tsx` 定义路径，`guards.tsx` 定义访问条件。
- 页面放 `src/pages/`，一个路由对应一个页面组件；页面负责组装布局与业务调用。
- 持久化状态放 `src/storage/`，只能通过导出的函数读写，不在组件里直接操作 `localStorage` / `sessionStorage`。
- API 客户端统一由 `src/api.ts` 的 `createApiClient()` 创建。

## 路由与守卫

路由顺序为：**先服务器配置，配置完成后进入 HomeTabsView**。登录不通过路由守卫跳转，而由 HomeTabsView 弹窗强制完成。

```text
/setup     未配置时展示；已配置 → /
/          未配置 → /setup；否则 HomeTabsView
/settings  未配置 → /setup；否则 WebSettingsPage
```

- 守卫使用 `RequireServerConfig`、`SetupOnly`；`RequireAuth`、`GuestOnly` 不再参与路由。
- 新增业务路由必须包在 `RequireServerConfig` 下；不要重新引入 `/login` 路由跳转，登录由 HomeTabsView 的 `LoginView` 处理。
- 路由使用 history 模式；生产静态托管必须把未知路径回退到 `index.html`（网关静态托管尚未实现）。

## 存储约定

| 内容 | 位置 | Key |
|---|---|---|
| 服务器配置列表（id、名称、地址、security_token、连通状态 `connected`、检查时间 `checkedAt`） | `localStorage` | `loong.web.server-config` |
| 登录用户数据（access/refresh token、用户信息，按服务器 ID 分开） | `localStorage` | `loong.web.user:<serverId>` |
| 页面设置（三栏布局宽度、折叠状态） | `localStorage` | `loong.web.settings` |
| 主题（light / dark，通过 `<html class="dark">` 切换） | `localStorage` | `loong.web.theme` |
| 已固定标签 key 列表 | `localStorage` | `loong.web.pinned-tabs` |
| 上次激活的标签 key | `localStorage` | `loong.web.active-tab` |

- 密码永不落盘；Token 只通过 `storage` 模块与 `createApiClient` 流转。
- 读取已存数据时必须校验字段类型，损坏数据按"未配置/未登录"处理。
- 清除用户数据用 `clearUser()`；清除服务器配置用 `clearServerConfig()`，不要手写 `removeItem`。
- 当前选中的服务器 `activeId` 只保存在内存中，不写入 storage。
- 登录信息按服务器 ID 隔离；`HomeTabsView` 在未登录时强制弹出登录框，登录成功前不可关闭。

## API 调用

- 统一使用：

```ts
import { createApiClient } from "./api";
const client = createApiClient({ locale });
await Effect.runPromise(client.auth.login({ username, password, platform: "web" }));
```

- `createApiClient` 负责 origin（服务器配置优先）、`locale` 与访问令牌，不要在页面里手工拼 URL 或认证头。
- 只从 `@loong/client`、`@loong/client/api`、`@loong/client/http`、`@loong/client/types`、`@loong/client/i18n` 导入，
  不直接引用其 `src/` 内部文件。
- 401 统一是 `UnauthorizedError`：`createApiClient` 会使用当前服务器的 refresh token 刷新一次并重试原请求；刷新失败才清理该服务器会话，并弹出「登录已过期」提示框，3 秒后跳转 HomeTabsView，由登录弹框重新登录。登录 / 注册 / 刷新接口本身不参与自动刷新；同一接口与参数在 3 秒内重复调用会被拒绝，并通过 `Message` 提示「操作太频繁」；请求成功后立即清除限流 key，允许下一次操作。

## UI 与样式

- 文案：共享组件（`@loong/ui`）自带 i18n，页面只需传 `locale`，不要给组件传文案 props；页面自身文案保持简洁，可复用 `@loong/ui/i18n`。
- 样式：只写 Tailwind 工具类；禁止 `<style>`、`style={...}` 内联样式与组件级 CSS 文件；颜色、间距、圆角、状态、`dark:` 规则遵循
  [shared/ui/AGENTS.md](../shared/ui/AGENTS.md) 的 UI 设计与 CSS 规范。
- 深浅色默认跟随系统，并可通过 `storage/theme.ts` 手动切换；主题通过 `<html class="dark">` 与 Tailwind `dark:` 变体生效，不要引入第二套主题机制。
- 页面根布局优先用 `ThreePaneLayout`，避免自己实现可折叠/可拖动分栏。
- 表单校验与错误展示遵循 [shared/ui/AGENTS.md](../shared/ui/AGENTS.md) 的「表单规范」：字段错误显示在输入框下方，使用 `aria-invalid` 与 `role="alert"`。

## 验证

在仓库根目录执行：

```powershell
bun install
bun run typecheck
bun run build:web
bun run --filter '@loong/web' dev   # http://127.0.0.1:5173
```

- 改动路由、存储或 API 调用后至少保证 `typecheck` 与 `build:web` 通过。
- 手工验证顺序：清空 `localStorage` → 应进入 `/setup`；保存配置 → 进入 `/`（HomeTabsView）并弹出登录框；登录成功后才能关闭弹框；切换服务器会使用对应服务器的登录态。
- 生产构建为静态资源，路由回退未实现前不要宣称可直接由网关托管。
- 不在本目录引入测试框架；集成测试放在 `local/tests` 或后续专门的 e2e 目录。
