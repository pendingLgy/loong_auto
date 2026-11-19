# 工程构建与验证索引

所有命令默认在仓库根目录执行。本文仅为操作说明，此次文档生成不执行依赖管理或构建命令。

Bun 工作区（`shared/client`、`shared/ui`、`web`）的统一安装、catalog 版本与构建命令见 [Bun 工程构建](../BUILD.md)。

## 模块说明

| 模块 | 文档 | 当前状态 |
| --- | --- | --- |
| cloud | [构建与启动](../cloud/BUILD.md) | 有服务和测试 |
| local | [构建与启动](../local/BUILD.md) | 健康检查骨架 |
| shared | [构建与使用](../shared/BUILD.md) | 公共契约与基础库 |
| tui | [构建与启动](../tui/BUILD_AND_RUN.md) | 目录骨架 |
| web | [构建与启动](../web/BUILD.md) | Bun + Vite，含登录页 |
| desktop | [构建与启动](../desktop/BUILD_AND_RUN.md) | 目录骨架 |

## Python 工程操作

需要 Python 3.12+ 和 uv。根目录统一约束依赖版本，子包声明实际依赖，共享根锁文件。

```powershell
uv sync --all-packages
uv run --package loong-cloud python -m unittest discover -s engineering/tests -v
uv build --package loong-contracts
uv build --package loong-local
uv build --package loong-cloud
```

首次同步会解析依赖并生成锁文件，构建默认输出到根 dist 目录。构建尚未在当前环境验证，不代表已有可分发产物。

云端启动需要额外环境变量，详见云端文档；本地服务可独立运行健康检查。当前尚不能完成 TUI / Web / Electron 到云端的完整业务联调。

## 后续工程能力

已建立根 Bun workspace（`shared/client`、`shared/ui`、`web`），依赖版本在根 `package.json` 的 `workspaces.catalog` 统一管理，安装统一在仓库根执行 `bun install`；Web 端使用 Bun + Vite（见 [Web 构建说明](../web/BUILD.md)）。TUI/Electron 构建脚本、PyInstaller 配置、Dockerfile 与部署流水线尚未建立。补齐对应实现后再维护可执行命令，不将规划命令标记为已有能力。

依赖组织见 [Python 工程管理](workspace/README.md)。
