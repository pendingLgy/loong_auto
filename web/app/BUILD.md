# app 构建与运行

`web/app` 对应包：

```text
@loong/web
```

技术栈：

- SolidJS 2
- Vite 8
- TypeScript
- Tailwind CSS 4
- Kobalte
- `@loong/web-api`
- `@solid-primitives/event-listener`

## 环境

- Bun
- Node.js 22.12+
- 依赖版本由根 `package.json` catalog 管理

## 安装

在仓库根目录执行：

```powershell
bun install
```

## 开发

```powershell
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

代理：

```text
/api -> http://127.0.0.1:9528
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

## 类型检查

```powershell
bun run typecheck
```

`web/app` 单包：

```powershell
bun run --filter '@loong/web' typecheck
```

## 启动配置

[index.html](index.html)

```html
<script type="module" src="/src/main.tsx"></script>
```

[vite.config.ts](vite.config.ts)

```ts
plugins: [solid(), tailwindcss()]
server: {
  host: "127.0.0.1",
  port: 5173,
  strictPort: true,
  proxy: { "/api": { target: "http://127.0.0.1:9528" } }
}
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
    ├── assets/icons/
    │   ├── GlobeIcon.tsx
    │   ├── PanelIcon.tsx
    │   ├── ServerIcon.tsx
    │   └── ThemeIcon.tsx
    ├── context/
    │   ├── GlobalContext.tsx
    │   ├── LayoutContext.tsx
    │   ├── LocaleContext.tsx
    │   └── ServerContext.tsx
    ├── page/
    ├── runtime/
    │   ├── http/
    │   │   ├── index.ts
    │   │   └── request_client.ts
    │   └── i18n/
    │       └── en-US.ts
    ├── store/
    │   ├── layout.ts
    │   ├── locale.ts
    │   ├── server.ts
    │   └── theme.ts
    └── view/
        ├── IndexView.tsx
        └── layout/MainLayout.tsx
```

## 关键模块

### MainLayout

- 左、中、右三栏；
- 左右折叠；
- 拖动调整宽度；
- 左侧服务器信息下拉；
- 语言与主题控制。

### Context

```text
GlobalContext   主题
ServerContext   服务器检查与配置
LocaleContext   国际化
LayoutContext   布局状态与拖动
```

### Store

```text
loong.web.theme
loong.web.layout
loong.web.locale
loong.web.server-config
```

### HTTP

`runtime/http/request_client.ts` 提供：

```ts
createHttpClient({
  baseUrl,
  timeoutMs,
  translate: t,
})
```

## 手工验证

1. 清空 `localStorage` 后打开应用，出现服务器配置弹窗；
2. 未配置服务器时弹窗不可关闭；
3. 测试连接失败时显示错误；
4. 连接成功后保存并关闭弹窗；
5. 左侧服务器图标可查看服务器信息与配置入口；
6. 左右折叠按钮控制对应区域；
7. 拖动分隔条调整宽度，刷新后保持；
8. 小屏时左右区域自动隐藏；
9. 语言切换与主题切换生效。

## 常见问题

### 找不到 `@loong/web-api`

先执行：

```powershell
bun run build:api
```

### 类型找不到 API 最新定义

重新构建 API 包并重启 Vite：

```powershell
bun run build:api
bun run dev:web
```
