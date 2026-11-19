# shared/client 协作规范

本文作用于 `shared/client`，补充根目录 [AGENTS.md](../AGENTS.md)。

## 职责边界

- 只提供 **TypeScript + Effect 的本地网关客户端**，供 Web、Electron、TUI 使用。
- 不依赖 `@loong/ui`、SolidJS 或任何 DOM API；必须能在浏览器、Node、Bun 中运行。
- 只访问本地网关；禁止直连云端业务地址，也禁止在客户端里保存令牌。
- 不做 UI 文案拼装、不做路由、不做业务状态管理；只负责请求、响应解析与领域字段映射。

## 分层与依赖方向

```text
src/types     ← src/http     ← src/api
src/i18n      ← src/http、src/api
```

- `src/types/`：请求参数、响应模型、`ClientError`；不依赖其它层。
- `src/http/`：`requestJson`、`parseEnvelope`、`prefix` 处理；只依赖 `types` 与 `i18n`。
- `src/api/`：`AuthApi`、`createLocalClient`；依赖 `http` 与 `types`。
- `src/index.ts`：barrel，导出 `api`、`http`、`types`、`i18n`。
- 禁止反向依赖：`types` 不得 import `api`/`http`；`http` 不得 import `api`。

## 文件与导出约定

- 一个网关分组一个文件：`src/api/<group>.ts`（如 `auth.ts`）；分组内只做接口编排与字段映射。
- 请求方法名与云端一致：`login` / `me` / `logout`。
- 请求参数与响应模型集中在 `src/types/<group>.ts`；禁止在 `api/` 里重复声明参数类型。
- 只通过 `package.json` 的 exports 暴露子路径：`.`、`./api`、`./http`、`./types`、`./i18n`、`./login`；
  消费端不要 import `src/` 内部文件。
- `login.ts` 是历史兼容入口，新代码优先从 `@loong/client` 或具体子路径导入。

## HTTP 层规范

- 所有请求必须经过 `requestJson`，禁止在 `api/` 里直接调用 `fetch`。
- URL 统一由 `withPrefix(prefix, path)` 拼接：`prefix` 默认 `/api/common`，路径写成相对形式（如 `/api/auth/login`）。
- 令牌通过 `HttpClientOptions.token` 传入，由 `requestJson` 自动添加 `Authorization: Bearer`；禁止在调用处手写认证头。
- 响应必须走 `parseEnvelope`：
  - 401（HTTP 状态或信封 `code === 401`）抛 `UnauthorizedError`；
  - 其它非 2xx 或 `code !== 200` 抛 `ClientError`；
  - 成功返回 `data`。
- `fetch` 可注入（测试用），但不要存到模块级可变状态。

## 错误与国际化

- `ClientError` 是唯一的基础错误类型；401 使用其子类 `UnauthorizedError`，用 `isUnauthorized(error)` 判断。
- 错误文案通过 `locale` 选择：默认 `zh-CN`，中文以内联 fallback 为准，英文维护在 `src/i18n.ts` 的 `enUS`；
  新增文案时必须同时给出中文 fallback 与英文 key。
- 服务端返回的 `msg` 优先于本地文案；不要覆盖云端明确错误。
- 日志与异常信息不得包含令牌、密码或完整请求体。

## 安全约束

- `assertLocalGateway` 只允许 `localhost` / `127.0.0.1` / `::1`，且拒绝带账号密码或非 http(s) 的 URL。
- 客户端不持久化令牌；令牌生命周期由消费端管理，按需通过 `createLocalClient({ token })` 传入。
- 不允许为重试、重连或自动刷新令牌偷偷加逻辑；由消费端显式处理 401。

## 验证

在仓库根目录执行：

```powershell
bun install
bun run typecheck
bun run build:web
```

- 改动接口后至少保证 `typecheck` 与 `build:web` 通过。
- 运行时验证可用 `Bun.serve` 起桩网关，覆盖成功、401、非 JSON、`code !== 200` 四类响应；
  不在本目录引入测试框架。
- 接口字段变化时同步更新 `shared/BUILD.md` 的模块说明。
