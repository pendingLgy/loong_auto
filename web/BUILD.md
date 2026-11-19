# Web 构建与启动

## 当前状态

Web 端由 Bun + Vite + SolidJS 管理，已包含登录页入口，可通过本机网关登录。

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

- 使用 Tailwind CSS v4（`@tailwindcss/vite` 插件），入口 `web/app/styles.css`。
- `shared/ui` 的组件在源码里使用 Tailwind 工具类，构建时通过 `@source "../../shared/ui/src"` 扫描。
- 新增消费端（如 Electron renderer）时需要引入 Tailwind，并把 `@source` 指向 `shared/ui/src`。

## 登录页

- 通用组件：`shared/ui/src/login/LoginPage.tsx`（不绑定网关/平台/会话，登录逻辑通过 `onSubmit` 注入）
- Effect 网关客户端：`shared/client/login.ts`（`@loong/client/login`）
- Web 入口：`web/pages/LoginPage.tsx`（负责网关调用、平台 `web` 与中文文案）
- 页面挂载：`web/app/main.tsx`，登录成功后会话暂存在内存（`web/app/session.ts`）

生产环境静态资源由本地网关托管（该服务尚未实现），前端不直接调用云端业务接口。
