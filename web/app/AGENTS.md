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
    ├── chat/
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
- 非字段级接口错误显示在表单底部，不伪装成某个输入框的错误。

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
