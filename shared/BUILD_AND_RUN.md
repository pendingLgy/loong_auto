# 共享模块构建与使用

shared 是库模块，没有独立服务启动入口。以下命令在仓库根目录执行。

## Python 公共契约

需要 Python 3.12+ 和 uv：

```powershell
uv sync --package loong-contracts
uv run --package loong-contracts python -m loong_contracts.export
uv build --package loong-contracts
```

Schema 导出到标准输出；构建产物默认写入根 dist 目录。云端与本地服务通过 workspace 依赖引用公共契约。

## TypeScript 客户端与组件

contracts、client、ui 已有 package.json 与基础源码，但尚未配置完整 Bun workspace、构建脚本与类型检查流水线，因此当前没有可承诺直接运行的统一安装或构建命令。

- contracts：公共 TypeScript 类型。
- client：Effect 本地网关客户端，由 TUI、Web 和 Electron 使用。
- ui：SolidJS DOM 组件，由 Web 和 Electron 使用；TUI 不导入该组件库。

这些库由消费端的构建工具处理。客户端依赖本地网关业务接口，当前本地服务尚未实现对应接口，不能完成界面端到端运行。

后续在工程设计中补充依赖同步、类型检查、协议生成和消费端集成命令。当前不提供虚构的 dev 或 build 脚本。
