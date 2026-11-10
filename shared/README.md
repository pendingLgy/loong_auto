# 共享模块

| 目录 | 已实现内容 |
| --- | --- |
| contracts | Python Pydantic 契约、JSON Schema 导出、TypeScript 类型 |
| client | 仅连接 loopback 本地网关的 Effect SDK、请求取消与 SSE 消费 |
| ui | SolidJS 任务状态与任务时间线组件，供 Web / Electron 使用 |

客户端使用 `/local/v1` 接口约定，本地网关尚未实现，因此当前无法端到端连接。工具结果提交只属于 Python 网关与云端协议，不向普通界面 SDK 暴露。

SDK 要求调用方提供响应解码函数，避免将 JSON 直接断言为可信类型。事件可使用导出 Schema 与 Ajv 构造解码器；请求取消由 Effect 生命周期控制。重连由调用方持有游标并发起，不隐式重试有副作用操作。

Python 契约位于 `contracts/src/loong_contracts`，通过 `uv run --package loong-contracts python -m loong_contracts.export` 导出 JSON Schema。当前 TypeScript 类型为初始对应版本，后续应加入生成器和契约一致性 CI，暂未声称已经自动生成。HTTP OpenAPI 可在云端启动后获取。

TUI 复用 client 和 contracts，不导入基于 DOM 的 ui。模型与工具内容仅按文本展示，不注入原始 HTML。

当前没有运行依赖安装命令；Effect、eventsource-parser 与 SolidJS 的依赖声明已写入各包 package.json，实际安装、类型检查和浏览器集成后续进行。
