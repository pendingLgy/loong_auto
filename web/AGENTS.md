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
- 页面放 `src/views/`，一个路由对应一个页面组件；页面负责组装布局与业务调用。
- 持久化状态放 `src/storage/`，只能通过导出的函数读写，不在组件里直接操作 `localStorage` / `sessionStorage`。
- API 客户端统一由 `src/api.ts` 的 `createApiClient()` 创建。

## 路由与守卫

路由顺序为：**先服务器配置，配置完成后进入 HomeView**。登录不通过路由守卫跳转，而由 HomeView 弹窗强制完成。

```text
/setup     未配置时展示；已配置 → /
/          未配置 → /setup；否则 HomeView
/settings  未配置 → /setup；否则 WebSettingsView
```

- 守卫使用 `RequireServerConfig`、`SetupOnly`；`RequireAuth`、`GuestOnly` 不再参与路由。
- 新增业务路由必须包在 `RequireServerConfig` 下；不要重新引入 `/login` 路由跳转，登录由 `HomeView` 的 `LoginView` 处理。
- 只允许一个服务器配置，不得恢复服务器列表、切换或新增服务器入口。
- 路由使用 history 模式；生产静态托管必须把未知路径回退到 `index.html`（网关静态托管尚未实现）。

## 存储约定

| 内容 | 位置 | Key |
|---|---|---|
| 唯一服务器配置（名称、地址、security_token、连通状态、检查时间） | `localStorage` | `loong.web.server-config` |
| 登录用户数据（access/refresh token、用户信息） | `localStorage` | `loong.web.user` |
| 工作区界面状态（布局、菜单、工作区/对话、当前对话、选中模型） | `localStorage` | `loong.web.workspace` |
| 已打开的工作区/会话标签 | `localStorage` | `loong.web.workspace-tabs` |
| 本地聊天消息（按 session） | `localStorage` | `loong.web.chat-messages:<sessionId>` |
| 待发送消息队列 | `localStorage` | `loong.web.chat-queue` |
| 主题（light / dark，通过 `<html class="dark">` 切换） | `localStorage` | `loong.web.theme` |

- 密码永不落盘；Token 只通过 `storage` 模块与 `createApiClient` 流转。
- 读取已存数据时必须校验字段类型，损坏数据按“未配置/未登录”处理。
- 只允许配置一个服务器；保存服务器配置使用 `saveServerConfig()`，清除使用 `clearServerConfig()`。
- 登录信息使用唯一 key；清除登录使用 `clearUser()`。
- 工作区状态、聊天消息与待发送队列不再带服务器 ID，session 是唯一隔离维度。
- 退出账号必须调用 `clearAllWebStorage()`，清空登录、工作区、标签、聊天、队列与主题数据，但保留 `loong.web.server-config`；只有显式清除服务器时才调用 `clearServerConfig()`。

## API 调用

- 统一使用：

```ts
import { createApiClient } from "./api";
const client = createApiClient({ locale });
await Effect.runPromise(client.auth.login({ username, password, platform: "web" }));
```

- `createApiClient` 负责唯一服务器的 origin、`security_token`、`locale` 与访问令牌，不要在页面里手工拼 URL 或认证头。
- 只从 `@loong/client`、`@loong/client/api`、`@loong/client/http`、`@loong/client/types`、`@loong/client/i18n` 导入，
  不直接引用其 `src/` 内部文件。
- 401 统一是 `UnauthorizedError`：`createApiClient` 使用唯一 refresh token 刷新一次并重试原请求；刷新失败才清理登录态，并弹出“登录已过期”提示框，3 秒后返回工作区重新登录。登录 / 注册 / 刷新接口本身不参与自动刷新；同一接口与参数在 3 秒内重复调用会被拒绝，并通过 `Message` 提示“操作太频繁”；请求成功后立即清除限流 key。

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
- 手工验证顺序：清空 `localStorage` → 应进入 `/setup`；保存唯一服务器配置 → 进入 `/` 并弹出登录框；登录成功后才能关闭弹框；刷新后恢复同一服务器登录态与本地状态。
- 生产构建为静态资源，路由回退未实现前不要宣称可直接由网关托管。
- 不在本目录引入测试框架；集成测试放在 `local/tests` 或后续专门的 e2e 目录。
