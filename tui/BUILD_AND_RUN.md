# TUI 构建与启动

## 当前状态

仅有目录骨架，尚未添加 package.json、应用入口或构建脚本。目前无法启动或构建 TUI。

## 技术与运行关系

- TypeScript、Bun、SolidJS、@opentui/solid。
- 通过共享客户端访问 Python 本地网关。
- 启动或复用本地网关，不直接连接云端。

## 后续补充

模块实现时再补充依赖同步、开发启动、类型检查和打包命令。构建需验证 OpenTUI 原生资源、Windows 终端与中文输入兼容性。

Python 本地服务的现有启动方式见 [本地服务说明](../local/BUILD_AND_RUN.md)。当前网关仅支持健康检查，不能驱动 TUI 业务。
