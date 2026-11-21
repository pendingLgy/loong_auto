# Web 构建与启动

## 当前状态

Web 端由 Bun + Vite + SolidJS 管理，登录在 HomeTabsView 内通过弹窗完成，可通过本机网关登录。

## 环境与依赖

- Bun 1.4+、Node 20+。
- 依赖安装（必须在仓库根目录执行，各子包不再单独安装）：

```powershell
bun install
```

依赖版本统一在根 `package.json` 的 `workspaces.catalog` 中维护，`web` 通过 `catalog:` 协议引用；`@loong/ui` 用 `workspace:*` 链接，登录组件直接从源码消费，不需要单独构建共享包。

## 开发

```powershell
bun run dev:web
```

- 开发地址：`http://127.0.0.1:5173`
- `/api` 由 Vite 代理到本地网关 `http://127.0.0.1:9528`，浏览器不直连云端。
- 使用前需先启动本地网关，见 [本地服务说明](../local/BUILD.md)。

## 构建与检查

```powershell
bun run typecheck     # @loong/web + @loong/ui 的类型检查
bun run build:web     # 产物输出到 web/dist
bun run --filter '@loong/web' preview
```

也可以在 `web/` 目录内执行 `bun run dev|build|typecheck`（依赖仍在根 `node_modules`）。

## 样式

- 使用 Tailwind CSS v4（`@tailwindcss/vite` 插件），入口 `web/src/styles.css`。
- `shared/ui` 的组件在源码里使用 Tailwind 工具类，构建时通过 `@source "../../shared/ui/src"` 扫描。
- 新增消费端（如 Electron renderer）时需要引入 Tailwind，并把 `@source` 指向 `shared/ui/src`。

## 目录结构

```text
web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx        # 挂载入口
    ├── App.tsx         # 根组件（仅渲染 AppRouter）
    ├── routers/        # 路由表与守卫
    │   ├── index.ts
    │   ├── guards.tsx  # RequireServerConfig / RequireAuth / GuestOnly / SetupOnly
    │   └── routes.tsx  # /setup、/、/settings 路由表
    ├── api.ts          # createApiClient（401 自动刷新并重试一次）
    ├── storage/        # 持久化状态
    │   ├── server_config.ts  # 多服务器配置与连通状态
    │   ├── settings.ts       # 页面设置（布局宽度、折叠状态）
    │   └── user.ts           # 登录用户数据（按服务器 ID 分开存储）
    ├── styles.css      # Tailwind 入口
    └── pages/          # 按功能拆分
        ├── server-workspace/
        │   ├── ServerWorkspaceView.tsx
        │   ├── HomeIndex.tsx
        │   └── home-context.ts
        ├── home-tabs/
        │   ├── HomeTabsView.tsx
        │   ├── AddServerDialog.tsx
        │   ├── ServerInfoDialog.tsx
        │   └── LoginView.tsx
        ├── login/
        │   └── WebLoginPage.tsx
        ├── server-config/
        │   └── WebServerConfigPage.tsx
        └── settings/
            └── WebSettingsPage.tsx
```

## 路由、配置与登录

路由守卫顺序：**只判断服务器配置**，登录校验已移除。

- `/setup`：服务器配置页；已配置时跳 `/`。
- `/`：未配置 → `/setup`；否则渲染 `HomeTabsView`。
- `/settings`：未配置 → `/setup`；否则渲染 `web/src/pages/settings/WebSettingsPage.tsx`（内部使用 `@loong/ui/settings` 的 `SettingsPage`）。
- `/login`、`RequireAuth`、`GuestOnly` 不再参与路由守卫；登录页文件保留，但当前流程不使用登录。
- 服务器配置以 `{ servers }` 存于 `localStorage`（`loong.web.server-config`），每项含 `id`、`name`、`serverUrl`、`token`、`connected`（连通状态）、`checkedAt`（最近检查时间）；`activeId` 仅保存在内存中，刷新后默认选中第一个服务器；`saveServerConfig` 仅在传入 `id` 时更新对应服务器，未传 id 时始终新增（不按 URL 去重）；名称重复会自动追加创建日期 `YYYY-MM-dd_HH:mm`（仍重复则再加序号），`setActiveServer` 切换当前服务器，`updateServerStatus` 更新连通状态，`removeServer` 删除；旧版单对象配置会自动迁移为数组。`createApiClient` 使用当前选中服务器的地址与 security_token；业务接口返回 401 时使用 refresh token 刷新并重试一次，刷新失败才清理当前服务器登录态，并弹出登录过期提示框，3 秒后返回 HomeTabsView 重新登录。
- 未登录时 `HomeTabsView` 强制弹出 `LoginView`（Web 适配层，内部使用 `@loong/ui/login` 的 `LoginDialog`），登录成功前不可关闭；用户数据（access/refresh token、用户信息）按服务器 ID 写入 `localStorage`（`loong.web.user:<serverId>`），切换服务器时读取对应账号；旧版本 `loong.web.user` / `loong.web.session` 会自动迁移到当前服务器。
- 页面设置（含三栏布局宽度、折叠状态）保存在 `localStorage`（`loong.web.settings`）；`ServerWorkspaceView` 的 `onLayoutChange` 会立即写入，下次打开优先读取。旧版本 `sessionStorage` 的 `loong.web.layout` 会自动迁移。
- 服务器配置写入后由配置页跳转 `/`，进入 `HomeTabsView`；未登录时在该页弹出登录框。

## 登录

- `HomeTabsView` 在服务器未登录时弹出 `@loong/ui/login` 的 `LoginDialog`（Web 侧 `LoginView` 负责登录 / 注册动作），登录弹窗只遮罩 HomeTabs 下方的工作区，不遮挡顶部标签栏；遮罩、Esc 与关闭按钮均不可用，登录成功后才自动关闭；弹窗 footer 左侧为注册链接、右侧为「登录」；点击注册链接切换到注册表单，注册成功后自动登录并关闭。
- 登录成功按当前服务器 ID 保存到 `localStorage`：`loong.web.user:<serverId>`；切换标签时自动切换对应服务器的登录态。
- `/settings` 的账号分组显示当前用户，并提供退出登录；退出会调用云端注销并清除当前服务器用户缓存，然后返回 `HomeTabsView`。
- `HomeTabs` 最右侧的退出按钮会先弹出确认框，确认后注销当前服务器、清除该服务器用户缓存、移除服务器配置及对应固定标签；若还有其他服务器则切换到下一个，全部移除后回到 `/setup`。
- `shared/ui/src/login/LoginPage.tsx` 与 `web/src/pages/login/WebLoginPage.tsx` 保留为整页登录方案，当前路由未挂载。

生产环境静态资源由本地网关托管（该服务尚未实现），前端不直接调用云端业务接口。
