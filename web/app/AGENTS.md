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
Global → Locale → Server → Login → Layout → MainLayout → SideNav
```

- `LoginContext` 只管理会话与持久化，不直接调用 API。
- 登录 / 注册调用在 `LoginDialog`，退出调用在 `SideNav`。
- 会话保存到 `loong.web.auth`。

## 请求与国际化

- `request.ts` 只发送请求并返回 `Response`。
- `api_client.ts` 负责绑定 endpoint、解析信封、错误处理。
- 自动携带 `Authorization`、`X-Security-Token`、`Accept-Language`。
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
