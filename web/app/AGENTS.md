# app 协作规范

作用于 `web/app`，补充 [web/AGENTS.md](../AGENTS.md)。

## 职责

- 负责 Web 页面、布局、交互、运行时请求与应用状态。
- 接口契约来自 `@loong/web-api`，HTTP 调用统一走 `runtime/http`，禁止页面直接 `fetch`。
- 不实现工具执行、审批或云端编排。
- 交互组件优先 Kobalte。

## 目录

```text
src/
├── assets/
├── context/
├── page/
├── runtime/
│   ├── http/
│   └── i18n/
├── store/
└── view/
    ├── layout/
    │   └── side_nav/
    ├── login/
    ├── setting/
    └── user/
```

- `store/` 只做持久化，不含 `createSignal`、JSX 或请求逻辑。
- `context/` 管理运行时状态与业务组合。
- `view/` 按页面、布局、登录、设置、用户拆分。
- `runtime/http/` 提供请求、endpoint 绑定与错误类型。
- `runtime/i18n/` 提供英文词典，中文通过 `t(key, fallback)` 提供。

## 布局与上下文

- `MainLayout`：左、中、右三栏、拖动与折叠。
- `SideNav`：客户端信息、语言 / 主题、用户菜单、设置入口。
- Provider 顺序：

```text
Locale → HttpClient → Global → IndexView → Server → Login → Layout → MainLayout → SideNav
```

- `LoginContext` 只管理会话与持久化，不直接调用 API。
- 登录 / 注册调用在 `LoginDialog`，退出调用在 `SideNav`。
- 会话保存到 `loong.web.auth`，`user_token = sha256(id + ":" + username)`。

## 持久化

- `store` 中写入浏览器的对象字段统一使用下划线命名。
- `loong.web.layout`：`left_width`、`right_width`、`left_open`、`right_open`。
- `loong.web.auth`：`access_token`、`refresh_token`、`token_type`、`expires_in`、`user`、`user_token`。
- `loong.web.server-config`：`url`、`security_token`。
- 旧版驼峰字段数据不兼容，不做迁移；缺失字段使用默认值。

## 请求与国际化

- `request.ts` 只发送请求并返回 `Response`。
- `HttpClientContext` 提供统一的 `apiClient()`，负责 endpoint 绑定、错误捕获与全局错误提示。
- `GlobalContext` 只管理主题。
- 自动携带 `Authorization`、`X-Security-Token`、`X-User-Token`、`Accept-Language`。
- `HttpClientContext` 使用 Effect 处理接口错误；401 时用 `refresh_token` 刷新并重试一次。
- 刷新接口仍返回 401 时清除会话，提示登录过期，3 秒后刷新页面。
- 捕获 `HttpRequestError` 时优先使用其 `message`。
- 中文使用 fallback：`t(key, "中文")`。

## 样式

- 只用 Tailwind 工具类。
- 禁止 `<style>`、`style={...}` 和组件级 CSS。
- 主题使用 `.dark`，遵循 [UI_Spec.md](../UI_Spec.md)。

## 验证

```powershell
bun run typecheck
bun run build:api
bun run build:web
```

手工检查：客户端配置、登录注册、会话恢复、左右折叠拖动、设置 Tabs、语言与主题切换。
