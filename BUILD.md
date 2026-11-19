# Bun 工程构建

本文说明仓库根目录的 Bun 工作区如何安装依赖、管理版本、开发与构建。Python 侧由 uv 管理，见 [工程模块结构](docs/project-structure.md)；前端各子模块的细节见 [web/BUILD.md](web/BUILD.md)、[shared/BUILD.md](shared/BUILD.md)。

## 环境要求

- Bun `1.4.4`：执行 `bun --version` 确认。
- Windows 下使用 PowerShell；所有命令都在**仓库根目录**执行。
- 不需要单独安装 Node.js；Vite、TypeScript 等通过 Bun 工作区解析。

## 工作区结构

```text
loong_auto/
├── package.json          # 工作区定义、catalog、根脚本
├── bunfig.toml           # hoisted 安装布局
├── bun.lock              # 唯一的锁文件
├── shared/
│   ├── client/           # @loong/client：本地网关客户端
│   └── ui/               # @loong/ui：Web / Electron 共用组件
└── web/                  # @loong/web：SolidJS + Vite 应用
```

`desktop/` 与 `tui/` 的 JS 工程尚未纳入 Bun 工作区；接入时先把包加入根 `package.json` 的 `workspaces.packages`。

## 安装依赖

```powershell
bun install
```

- 只在根目录安装一次，不要在 `web/`、`shared/ui/` 等子目录单独执行。
- 依赖统一提升到根 `node_modules`（`bunfig.toml` 中 `linker = "hoisted"`），Vite 与 `vite-plugin-solid` 依赖这一布局。
- 提交 `bun.lock`；不要提交 `node_modules`、`dist`、`.vite` 缓存。

## 版本管理（catalog）

所有第三方版本在根 `package.json` 的 `workspaces.catalog` 中维护，子包用 `catalog:` 引用：

```json
{
  "workspaces": {
    "packages": ["shared/client", "shared/ui", "web"],
    "catalog": {
      "solid-js": "^1.9.20",
      "vite": "^6.4.6"
    }
  }
}
```

子包依赖：

```json
{
  "dependencies": {
    "solid-js": "catalog:"
  }
}
```

新增依赖的流程：

1. 在根 `package.json` 的 `catalog` 中加版本；
2. 在目标子包 `package.json` 中写 `"catalog:"`；
3. 在根目录执行 `bun install`；
4. 提交 `package.json` 与 `bun.lock`。

不要在子包写死版本号，也不要把 catalog 放进 `bunfig.toml`（Bun 只识别根 `package.json` 的 catalog）。

## 更新依赖

### 升级单个依赖

1. 修改根 `package.json` 中 `workspaces.catalog` 的版本；
2. 在仓库根目录执行 `bun install`；
3. 执行 `bun run typecheck` 与 `bun run build:web`，涉及组件或样式时再跑预览；
4. 同步更新相关文档中的版本与命令说明。

catalog 中的 `^` 范围决定可接受的更新范围；跨大版本升级时要额外评估 API 与构建配置变更。

### 批量更新

- `bun update`：按各包声明的 semver 范围重新解析，并更新 `bun.lock`；
- `bun update <name>`：只更新指定依赖；
- `bun update --latest`：忽略现有范围升级到最新，会改写 `package.json`，需要逐项 review；
- `bun update --dry-run`：只查看将要发生的变更，不写入文件。

catalog 的版本声明以根 `package.json` 为准。执行 `bun update` 后检查 catalog 是否被意外改写；如有，手工恢复期望版本并重新 `bun install`，不要只改子包。

### 更新子包依赖

- **新增**：先在根 `catalog` 增加版本，再在子包 `package.json` 中写 `"<name>": "catalog:"`，最后在根目录 `bun install`；
- **升级**：只修改根 `catalog` 版本，子包里的 `catalog:` 引用不用改；
- **移除**：删除子包中的依赖声明与 `catalog` 条目，再执行 `bun install`；
- **工作区内部依赖**：`@loong/client`、`@loong/ui` 使用 `workspace:*`，跟随工作区版本，不要写进 catalog。

### 更新锁文件

- 正常的 `bun install` 会同步更新 `bun.lock`；
- 需要强制重新解析时执行 `bun install --force` 或 `bun update --force`；
- 只有确认需要完全重建依赖树时才删除 `bun.lock`，之后重新 `bun install`；
- 提交时保持 `package.json`、子包依赖与 `bun.lock` 的变更一致。

### 更新 Bun 自身

```powershell
bun upgrade
```

升级后更新本文件「环境要求」中的版本号，并在 CI 或开发机镜像中同步，避免本地与流水线版本不一致。

### 更新依赖后的文档检查

依赖或工具链变化后，按范围检查并按需更新：

- 根 [BUILD.md](BUILD.md)：环境要求、命令、排错；
- [web/BUILD.md](web/BUILD.md)、[shared/BUILD.md](shared/BUILD.md)、[shared/ui/README.md](shared/ui/README.md)；
- [engineering/BUILD_AND_RUN.md](engineering/BUILD_AND_RUN.md) 的总索引；
- Python 侧依赖由 uv 管理，更新对应模块的 BUILD 文档，不在本文件展开。

### 验证

```powershell
bun install
bun run typecheck
bun run build:web
bun run --filter '@loong/ui' preview   # 涉及组件或样式时
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `bun install` | 安装/同步工作区依赖 |
| `bun run typecheck` | `@loong/web` + `@loong/ui` 的 TypeScript 检查 |
| `bun run dev:web` | 启动 Web 开发服务器（`http://127.0.0.1:5173`） |
| `bun run build:web` | 构建 Web 生产产物到 `web/dist` |
| `bun run --filter '@loong/ui' preview` | 组件预览画廊（`http://127.0.0.1:5174`） |
| `bun run --filter '@loong/ui' typecheck` | 只检查 UI 包 |
| `bun run --filter '@loong/web' typecheck` | 只检查 Web 包 |
| `bun update [name]` | 按 semver 范围更新依赖并刷新 `bun.lock` |

带 `--filter` 的命令可以在根目录执行，也可以在对应包目录执行其 `package.json` 脚本。

## 构建产物

- Web：`web/dist/`，由 Vite 生成，静态资源可交给本地网关托管；路由为 history 模式，生产静态托管需要把未知路径回退到 `index.html`。
- 组件预览：`vite` 开发服务器，不产出构建物，不参与生产构建。
- 生产构建前确认 `bun run typecheck` 通过；构建后不要在仓库提交 `dist`。

## Tailwind CSS

- 使用 Tailwind v4 + `@tailwindcss/vite`，无 `tailwind.config.js`。
- Web 入口 `web/src/styles.css` 通过 `@source "../../shared/ui/src"` 扫描共享组件；预览入口 `shared/ui/preview/styles.css` 通过 `@source "../src"` 扫描。
- 新增被扫描目录时同步修改 `@source`，否则样式不会生成。

## 缓存与排错

- 依赖或插件配置变化后 Vite 会重新优化依赖；出现陈旧模块时删除 `node_modules/.vite` 再启动。
- 端口被占用：Web `5173`、预览 `5174`，先停止占用进程再启动。
- `React is not defined` 一类错误通常是 `.tsx` 未经过 `vite-plugin-solid`：检查 Vite 配置中的 `solid()` 插件与 `esbuild.jsxImportSource`。
- `process is not defined`：`@astrojs/markdown-remark` 的浏览器构建引用了 `process.env`，`web` 与预览的 Vite 配置已用 `define` 替换为空对象；改动后清除 `node_modules/.vite` 缓存再启动。
- 工作区解析异常时优先重新执行根目录 `bun install`，不要手工修改 `node_modules`。

## 相关文档

- [web/BUILD.md](web/BUILD.md)：Web 的开发、构建、路由与存储。
- [shared/BUILD.md](shared/BUILD.md)：shared 下客户端与 UI 组件的构建与消费。
- [shared/ui/README.md](shared/ui/README.md)：组件预览画廊与样式扫描。
- [engineering/BUILD_AND_RUN.md](engineering/BUILD_AND_RUN.md)：整体构建与运行入口说明。
