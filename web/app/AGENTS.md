# app 协作规范

本文作用于 `web/app`，补充 [web/AGENTS.md](../AGENTS.md) 与根目录 [AGENTS.md](../../AGENTS.md)。

## 职责边界

- 本包只负责 Web 页面、布局、交互与应用状态。
- 后端请求统一使用 `@loong/web-api`，禁止直接使用 `fetch` 或直连云端。
- 不实现工具执行、权限审批或云端编排。
- 交互组件优先使用 Kobalte；应用暂不依赖 `@loong/ui` 组件。

## 目录

```text
src/
├── App.tsx
├── main.tsx
├── styles.css
├── assets/icons/
├── context/
├── page/
├── runtime/http/
├── runtime/i18n/
├── store/
└── view/
    ├── IndexView.tsx
    ├── setting/SettingsDialog.tsx
    └── layout/
        ├── MainLayout.tsx
        └── SideNav.tsx
```

- `view/`：页面；`view/layout/` 只负责区域结构。
- `page/`：后续独立页面模块。
- `context/`：Provider、hooks 与跨组件业务组合。
- `store/`：状态与持久化；不包含 JSX。
- `runtime/http/`：HTTP 请求工具。
- `runtime/i18n/`：语言词典；中文使用 fallback。

## 布局

- `MainLayout` 负责左、中、右三栏。
- 左右栏支持折叠，宽度支持拖动。
- 布局状态写入 `loong.web.layout`。
- 拖动与折叠状态由 `LayoutContext` 管理；`MainLayout` 只负责渲染。
- 左侧在 `lg` 以下自动隐藏。

## 状态与 Context

- `GlobalContext`：主题模式，持久化到 `loong.web.theme`。
- `LayoutContext`：左右宽度、折叠状态、拖动事件。
- `LocaleContext`：语言状态、词典、`t()`。
- `ServerContext`：服务器地址、健康检查、配置弹窗。
- `LoginContext`：登录会话、登录、注册与退出。
- `SideNavContext`：左侧导航下拉、退出确认与设置面板状态。
- `store` 只做持久化；Context 负责运行时组合。

### Provider 层级

```text
GlobalProvider
└── IndexView
    └── ServerProvider
        └── LocaleProvider
            └── LoginProvider
                └── LayoutProvider
                    └── MainLayout
                        └── SideNavProvider
                            └── SideNav
```

## 国际化

- 词典：`runtime/i18n/en-US.ts`。
- 中文默认使用 fallback：

```ts
t("server.config.title", "配置本地服务")
```

- 不使用单独的中文词典文件。
- 所有用户可见文案通过 `useLocaleContext().t` 获取。

## HTTP

- 请求客户端位于 `runtime/http/request_client.ts`。
- 支持超时、取消、JSON、错误与 i18n。
- 使用时传入 `translate: t`。
- 业务接口契约来自 `@loong/web-api`。

## 样式

- 只使用 Tailwind 工具类。
- 禁止 `<style>`、`style={...}` 内联样式与组件级 CSS。
- 颜色、圆角、间距遵循 [UI_Spec.md](../UI_Spec.md)。
- 主题通过 `.dark` 类切换。

## 验证

```powershell
bun run typecheck
bun run build:api
bun run build:web
```

手工检查：

1. 无服务器配置时弹出配置弹窗；
2. 测试连接与保存连接正常；
3. 左右栏折叠、拖动、刷新后恢复；
4. 左侧服务器信息与配置入口可用；
5. 语言与主题切换生效。
