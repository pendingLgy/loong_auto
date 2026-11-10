# Vibe Coding 平台技术栈

版本：v0.3 选型草案  
日期：2026-11-10  
关联文档：[整体架构](architecture-design.md)

## 1. 文档范围

本文按大模块说明职责范围与主要技术选型，不展开子模块、内部接口、数据结构及实现细节。相关内容由后续模块设计文档补充。

当前技术选型作为开发基线，具体版本与兼容性在工程初始化及模块设计时确认，通过锁文件管理依赖。

## 2. 技术栈总览

| 大模块 | 职责范围 | 主要技术                                                 |
| --- | --- |----------------------------------------------------------|
| 本地服务 | CLI 网关、云端转发、本地执行、权限、日志与状态 | Python、uv、FastAPI、asyncio、SQLite                     |
| 终端交互 | CLI 命令与 TUI 界面 | TypeScript、Bun、SolidJS、@opentui/solid                 |
| Web 界面 | 浏览器交互及桌面共享界面 | TypeScript、SolidJS、Effect、Vite、Bun                   |
| 桌面应用 | 桌面宿主、系统集成与本地服务启动 | Electron、TypeScript、electron-vite、electron-builder    |
| 云端服务 | API、Agent、LLM 接入与任务持久化 | Python、uv、FastAPI、PostgreSQL                          |
| 通信与契约 | 跨端请求、事件与类型约束 | HTTP、SSE、Pydantic、OpenAPI、JSON Schema                |
| 工程与交付 | 依赖管理、质量检查、测试、构建与分发 | uv、Bun、pytest、Vitest、Playwright、PyInstaller、Docker |

## 3. 本地服务

**职责范围**：作为所有界面的统一业务网关，连接云端，管理本地工具执行、权限审批、日志和恢复状态。

| 技术 | 用途 |
| --- | --- |
| Python + uv | 服务实现及工程管理 |
| FastAPI + Uvicorn | 本地 API、事件服务及 Web 静态资源服务 |
| asyncio | 异步任务、连接与进程管理 |
| HTTPX + httpx-sse | 云端 HTTP 请求与 SSE 事件消费 |
| Pydantic | 数据校验与配置模型 |
| SQLite + SQLAlchemy + Alembic | 本地状态存储与迁移 |
| Python logging | 本地结构化日志 |

本地服务由 CLI 启动或管理，也可由 Electron 启动或复用。所有业务请求、云端事件及工具结果均经过本地服务并记录日志。本地服务不使用 WebSocket。

具体工具、权限、日志、存储与进程管理方案由本地服务设计文档补充。

## 4. 终端交互

**职责范围**：提供命令行操作与终端交互界面，通过本地服务完成业务操作。

| 技术 | 用途 |
| --- | --- |
| TypeScript + Bun | 终端程序实现、运行与工程管理 |
| SolidJS + @opentui/solid | 终端响应式组件与交互界面 |
| OpenTUI | 终端渲染与输入处理 |
| Effect | 本地服务调用、事件订阅及异步业务管理 |

终端入口启动或复用 Python 本地网关，通过本地接口完成业务操作，不重复实现云端连接和本地工具执行。终端与 Web 可共享客户端能力，分别使用终端和 DOM 组件。命令组织、交互流程及终端兼容性由终端模块设计补充。

## 5. Web 界面

**职责范围**：提供会话、任务、审批、代码变更与设置等界面，同时作为 Electron 的共享渲染界面。

| 技术 | 用途 |
| --- | --- |
| TypeScript | 前端实现语言 |
| SolidJS + Solid Router | 响应式界面与路由 |
| Effect | 客户端异步业务、错误与资源管理 |
| Vite + Bun | 开发、包管理与构建 |
| Kobalte + Tailwind CSS | 基础交互组件与样式 |
| Monaco Editor | 代码与 Diff 展示 |

采用 SPA，由本地服务提供生产静态资源。业务请求统一访问本地服务，不直接连接云端。组件划分、页面流程及客户端状态设计由 Web 模块设计补充。

## 6. 桌面应用

**职责范围**：提供桌面窗口、系统集成，以及本地 Python 服务的启动与复用。

| 技术 | 用途 |
| --- | --- |
| Electron + TypeScript | 桌面宿主 |
| 共享 SolidJS 界面 | 桌面渲染界面 |
| electron-vite | 桌面工程开发与构建 |
| electron-builder | 安装包与发布 |
| 打包后的 Python 本地程序 | 提供本地网关和执行能力 |

Electron 使用内置 Node.js 运行宿主逻辑，通过独立进程管理 Python 本地程序。桌面应用不另行实现云端连接和工具执行。宿主接口、安全配置及生命周期由桌面模块设计补充。

## 7. 云端服务

**职责范围**：接收任务，管理会话与上下文，调用 LLM，编排工具调用，并保存云端任务状态。

| 技术 | 用途 |
| --- | --- |
| Python + uv | 服务实现及工程管理 |
| FastAPI + Uvicorn | 云端 API 与 SSE 事件服务 |
| asyncio | 异步任务与连接管理 |
| Pydantic | 数据模型与校验 |
| PydanticAI（待验证） | 模型与工具调用集成 |
| PostgreSQL + SQLAlchemy + asyncpg | 云端持久化 |
| Alembic | 数据库迁移 |

PydanticAI 需验证本地工具结果回传后的任务继续能力；具体模型框架可通过适配层调整。云端不直接执行用户电脑上的工具。Agent、模型接入、认证及任务调度方案由云端模块设计补充。

## 8. 通信与契约

**职责范围**：定义界面、本地服务与云端之间一致的数据与通信边界。

| 技术 | 用途 |
| --- | --- |
| HTTP / HTTPS | 提交业务请求、审批、取消和工具结果 |
| SSE | 推送模型输出、工具请求和任务状态 |
| Pydantic + JSON Schema | Python 数据契约与事件描述 |
| OpenAPI | HTTP 接口描述 |
| openapi-typescript + Ajv | TypeScript 类型生成与运行时校验 |

界面与本地服务、本地服务与云端均采用 HTTP + SSE，不使用 WebSocket。协议字段、版本兼容、幂等和恢复规则由通信设计文档补充。

## 9. 工程与交付

**职责范围**：管理多语言工程、质量检查、测试、构建和分发。

| 范围 | 技术 |
| --- | --- |
| Python 工程 | uv workspace、pyproject.toml、uv.lock |
| 前端工程 | Bun workspaces、package.json、bun.lock |
| Python 质量与测试 | Ruff、mypy、pytest |
| TypeScript 质量与测试 | tsc、ESLint、Prettier、Vitest |
| 界面端到端测试 | Playwright |
| 本地 Python 程序分发 | PyInstaller |
| 桌面分发 | electron-builder |
| 云端部署 | Docker、PostgreSQL |

uv 负责 Python 工程与依赖，PyInstaller 负责独立程序打包；Bun 负责 Web 与终端工程，并作为终端程序运行时。终端独立分发时需验证 OpenTUI 及相关资源的打包兼容性。各平台构建、签名、兼容性与发布流水线由工程设计文档补充。

## 10. 统一技术约束

- 所有界面业务操作统一经过 Python 本地网关访问云端。
- 云端负责推理与编排，本地负责权限与实际执行。
- Effect 用于 TypeScript 客户端，Python 异步逻辑使用 asyncio。
- Web 与 Electron 共享前端界面，CLI 与 TUI 共用本地服务能力。
- 日志记录与可靠业务状态分别管理。
- 子模块拆分及具体依赖在后续设计中确定，避免提前引入无明确需求的框架。
