# Electron 构建与启动

## 当前状态

仅有 main、preload、renderer 目录骨架，尚未添加 Electron 入口、package.json 和打包配置。目前无法启动或生成安装包。

## 技术与运行关系

- Electron、TypeScript、electron-vite、electron-builder。
- 共享 Web 界面，启动或复用 Python 本地网关。
- 桌面安装包计划附带独立 Python 程序；该程序的打包配置尚未实现。
- 所有业务流量经本地网关，不在 Electron 中重复实现工具和云端连接。

## 后续补充

模块实现时再补充开发启动、renderer 构建、Python 产物准备、安装包生成与安装验证命令。发布需分别处理目标系统和架构、代码签名、更新及第三方产物。

现有 Python 服务启动方式见 [本地服务说明](../local/BUILD_AND_RUN.md)。
