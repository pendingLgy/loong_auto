# web 协作规范

本文作用于 `web/`，补充根目录 [AGENTS.md](../AGENTS.md)。

## 职责边界

- `web/app` 是 SolidJS 浏览器应用，负责页面、布局、交互与应用状态。
- `web/ui` 是 `@loong/ui` 组件库，负责可复用组件、主题 token 与组件预览。
- `web/api` 是 `@loong/web-api`，负责接口契约、请求类型、SDK 配置与实际客户端入口。
- 应用只通过本地网关访问后端；禁止直连云端接口或在页面中直接书写 `fetch`。
- 不在 `web` 内实现工具执行、权限审批或云端编排，这些属于 `local` / `cloud`。

## 目录约定

```text
web/
├── app/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── styles.css
│       ├── assets/icons/
│       ├── context/
│       ├── page/
│       ├── runtime/
│       │   ├── http/
│       │   └── i18n/
│       ├── store/
│       └── view/
│           └── layout/
├── api/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── client.ts
│       ├── config.ts
│       ├── sdk/
│       │   ├── cloud_*.ts
│       │   └── local_*.ts
│       ├── types/
│       └── index.ts
└── ui/
    ├── package.json
    ├── tsconfig.json
    ├── preview/
    └── src/
        ├── menu/
        ├── workspace/
        ├── index.ts
        └── styles.css
```

## 分层规则

### app

- `view/`：页面与布局；`layout/` 只处理区域结构。
- `page/`：后续独立页面模块。
- `context/`：Provider、hooks 与业务组合。
- `store/`：状态与持久化；store 不包含组件逻辑。
- `runtime/http/`：请求客户端，不直接写页面请求。
- `runtime/i18n/`：语言词典；中文使用 `t(key, fallback)` 的 fallback。
- `assets/icons/`：应用图标组件。

### api

- `sdk/`：按 `local_*` / `cloud_*` 文件划分接口。
- 每个接口使用 `ApiEndpoint<Request, Response, Method, Path>`，地址、请求类型与类型定义写在一起。
- `config.ts` 只保留通用配置类型、`DEFAULT_API_CONFIG` 与 `endpointPath()`。
- `client.ts` 聚合 `ApiClient` 并导出实际客户端入口。
- `types/` 保存请求、响应、原始 payload 与错误类型；错误类型复用 `@loong/client`。
- `@loong/web-api` 编译到 `dist`，应用通过 `@loong/web-api` 导入。

### ui

- 组件按类别放在 `ui/src` 子目录，通过 `ui/src/index.ts` 导出。
- 组件按 `UI_Spec.md` 使用 Indigo 主色、Light/Dark、4px 间距与圆角规范。
- `preview/` 是独立 Vite 预览应用，不参与应用构建。
- 样式只使用 Tailwind 工具类，主题 token 放 `ui/src/styles.css`。

## 状态与 Context

- `GlobalContext`：主题模式。
- `LayoutContext`：左右栏宽度、展开状态、拖动事件。
- `LocaleContext`：语言状态、词典与翻译。
- `ServerContext`：服务器地址、健康检查、配置弹窗与测试连接。
- store 只处理持久化数据；Context 负责运行时组合。

## 依赖与导入

- 工作区依赖统一使用根 `package.json` 的 `catalog`，包内写 `"catalog:"`。
- 应用依赖 `@loong/ui`、`@loong/web-api`、SolidJS、Kobalte、Effect 等。
- 只从 `@loong/client`、`@loong/client/api`、`@loong/client/http`、`@loong/client/types`、`@loong/client/i18n` 导入，不直接引用其 `src/` 内部文件。
- `@loong/ui` 以源码形式被 Vite 消费，不预打包。

## UI 规范

- 遵循 [UI_Spec.md](UI_Spec.md)。
- 禁止 `<style>`、`style={...}` 内联样式与组件级 CSS 文件。
- 主题通过根节点 `.dark` 与 Tailwind `dark:` 变体实现。
- 表单错误显示在输入框下方，使用 `aria-invalid` 与 `role="alert"`。
- 文案统一经 `LocaleContext` 的 `t()` 获取。

## 验证

在仓库根目录执行：

```powershell
bun install
bun run typecheck
bun run build:api
bun run build:web
bun run --filter '@loong/ui' build:preview
```

- 修改 API 后必须先构建 `@loong/web-api`。
- 修改应用或 UI 后至少保证 `typecheck` 与 `build:web` 通过。
- 不在 `web` 中引入测试框架；集成测试放 `local/tests` 或后续 e2e 目录。
