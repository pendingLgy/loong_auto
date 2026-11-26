# @loong/web

`web/app` 是 Loong 的 Web 页面应用，使用 SolidJS 2 + Vite 8 + Tailwind CSS 4。

## 功能

- 左、中、右三栏布局；
- 左右栏可折叠；
- 左右栏宽度可拖动，并持久化；
- 服务器配置、健康检查与测试连接；
- 服务器信息下拉面板；
- 中文 fallback / 英文词典国际化；
- Light / Dark 主题切换。

## 开发

在仓库根目录先构建 API 包，再启动应用：

```powershell
bun install
bun run build:api
bun run dev:web
```

或在 `web/app` 内：

```powershell
bun run dev
```

地址：

```text
http://127.0.0.1:5173
```

`/api` 代理到：

```text
http://127.0.0.1:9528
```

## 构建

```powershell
bun run build:api
bun run build:web
```

产物：

```text
web/app/dist
```

## 目录

```text
web/app/
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── styles.css
    ├── api/
    │   └── client.ts
    ├── assets/icons/
    ├── context/
    │   ├── GlobalContext.tsx
    │   ├── LayoutContext.tsx
    │   ├── LocaleContext.tsx
    │   └── ServerContext.tsx
    ├── page/
    ├── runtime/
    │   ├── http/
    │   └── i18n/
    ├── store/
    │   ├── layout.ts
    │   ├── locale.ts
    │   ├── server.ts
    │   └── theme.ts
    └── view/
        ├── IndexView.tsx
        ├── setting/
        │   ├── AppearanceSettings.tsx
        │   ├── ClientSettings.tsx
        │   ├── LanguageSettings.tsx
        │   ├── SettingsDialog.tsx
        │   └── classes.ts
        └── layout/
            ├── MainLayout.tsx
            └── SideNav.tsx
```

## 分层

- `view`：页面与布局；
- `context`：Provider、hooks 与业务组合；
- `store`：状态与持久化；
- `runtime/http`：请求客户端；
- `runtime/i18n`：英文词典；
- `assets/icons`：应用图标。

## Provider 层级

```text
GlobalProvider
└── IndexView
    └── LocaleProvider
        └── ServerProvider
            └── LoginProvider
                └── LayoutProvider
                    └── MainLayout
                        └── SideNavProvider
                            └── SideNav
```

## 验证

```powershell
bun run typecheck
bun run build:api
bun run build:web
```

## 文档

- [AGENTS.md](AGENTS.md)
- [BUILD.md](BUILD.md)
- [../AGENTS.md](../AGENTS.md)
