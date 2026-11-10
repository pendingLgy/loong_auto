# Web 构建与启动

## 当前状态

仅有目录骨架，尚未添加 package.json、Vite 配置和页面入口。目前没有可执行的 dev 或 build 脚本。

## 技术与运行关系

- TypeScript、SolidJS、Effect、Vite，使用 Bun 管理前端工程。
- 开发环境通过本地 API 代理连接 Python 网关。
- 生产静态资源由本地网关提供，不直接调用云端业务接口。
- 与 Electron 共享 DOM 界面组件。

## 后续补充

模块实现时再补充依赖同步、开发服务、生产构建、静态资源部署和端到端验证命令。需同时补齐本地网关业务接口与静态资源服务。

现有 Python 服务启动方式见 [本地服务说明](../local/BUILD_AND_RUN.md)。
