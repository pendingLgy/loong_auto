# 工程模块结构

版本：v0.3  
日期：2026-11-26  
关联文档：[整体架构](architecture-design.md)、[技术栈](technology-stack.md)

## 1. 范围

工程采用 Monorepo，统一管理 TUI、Web、Electron、本地服务和云端服务。本文仅定义工程模块及其下一层子模块，不展开文件、类、接口和内部实现。

用户端仅包含 TUI、Web 和 Electron。所有业务操作通过 Python 本地网关访问云端，通信采用 HTTP + SSE。

## 2. 工程目录

以下为逻辑模块结构，结合当前实现更新；目录存在不表示功能已经完成。顶层为工程模块，下一层为子模块；子模块内部结构由各模块设计文档补充。Python 实际源码使用 src 包布局，local 的子模块位于 local/src/loong_local，cloud 的子模块位于 cloud/src/loong_cloud，公共 Python 契约位于 shared/contracts/src/loong_contracts。

```text
loong_auto/
├── tui/                        # 终端交互模块
│   ├── app/                    # 应用入口与生命周期
│   ├── views/                  # 终端视图
│   └── components/             # 终端交互组件
├── web/                        # 浏览器界面模块
│   ├── app/                    # @loong/web 页面、布局与运行时
│   ├── api/                    # @loong/web-api 接口契约与客户端入口
│   └── ui/                     # @loong/ui 组件库与预览
├── desktop/                    # Electron 桌面模块
│   ├── main/                   # 桌面宿主与本地服务管理
│   ├── preload/                # 受限宿主接口
│   └── renderer/               # 共享 Web 界面的桌面入口
├── local/                      # Python 本地服务模块
│   ├── gateway/                # 网关配置与协调能力
│   ├── api/                    # 本地状态接口、云端 HTTP/SSE 转发路由
│   ├── middleware/             # 本机访问校验与跨域装配
│   ├── executor/               # 工具调度与执行生命周期
│   ├── tools/                  # Shell、文件、搜索与 Git
│   ├── access/                 # 本地认证、权限与审批
│   ├── storage/                # 本地状态与迁移
│   ├── logger/                 # 本地业务日志
│   └── platform/               # 系统进程、凭证与路径适配
├── cloud/                      # Python 云端服务模块
│   ├── api/                    # 业务路由、聊天接口与 SSE 连接
│   ├── middleware/             # 请求上下文、用户认证与租户解析
│   ├── config/                 # 配置模型与统一加载
│   ├── core/                   # 容器、日志与基础能力
│   ├── common/                 # 公共响应与分页封装
│   ├── constant/               # 缓存 key 等公共常量
│   ├── db/                     # 数据库代理、Session 与连接管理
│   ├── cache/                  # 缓存代理及 SQLite 实现
│   ├── schema/                 # 数据表定义与注册
│   ├── storage/                # 用户、令牌、消息及会话存储
│   ├── agent/                  # 模型执行、供应商适配与工具循环
│   ├── exception/              # 异常定义
│   ├── utils/                  # 通用辅助能力
│   └── tests/                  # 云端单元测试及真实服务集成测试
├── shared/                     # 共享能力模块
│   ├── contracts/              # 协议定义、Schema 与生成类型
│   └── cloud_client/           # Python HTTPX 云端 SDK，复用 contracts
├── engineering/                # 工程与交付模块
│   ├── workspace/              # 跨模块工程配置
│   ├── scripts/                # 开发与生成脚本
│   ├── tests/                  # 跨模块集成与端到端测试
│   ├── packaging/              # 本地程序与桌面打包
│   └── deployment/             # 云端部署配置
├── http_test/                  # 手工 HTTP 接口调试
└── docs/                       # 设计文档模块
    ├── modules/                # 后续模块设计文档
    └── decisions/              # 架构决策记录
```

上图为模块视图，不是物理路径：local 的应用装配位于 `local/src/loong_local/app.py`，路由与中间件分别位于 api、middleware 子模块。cloud 的业务子模块位于 `cloud/src/loong_cloud`，测试位于 `cloud/tests`；应用装配和启动入口在 Python 包根目录，不单独展开。`providers` 和 `server` 暂未承担实际接入职责，不作为新增重复实现的依据。

现有架构、技术栈和本文保留在 docs 根目录。根级 workspace、锁文件等不在模块目录树中展开；Python 依赖版本在根 pyproject.toml 统一约束，子包声明实际依赖与构建配置，详见 [工程管理说明](../engineering/workspace/README.md)。TypeScript 工程由 Bun 管理。

## 3. 模块边界

| 工程模块 | 技术方向 | 职责边界 |
| --- | --- | --- |
| tui | TypeScript、SolidJS、@opentui/solid、Bun | 终端界面，通过本地接口访问本地服务 |
| web | TypeScript、SolidJS、Effect、Vite | 浏览器界面，包含页面、接口契约与组件库 |
| desktop | Electron、TypeScript | 桌面宿主，启动或复用本地网关 |
| local | Python、uv | 本地网关、权限、执行、日志与状态管理 |
| cloud | Python、uv | 云端接入、推理、任务编排和持久化 |
| shared | Python 契约 | 共享跨端协议与生成类型 |
| engineering | 工程配置与自动化工具 | 开发、验证、打包与部署支持 |
| docs | Markdown | 架构、模块设计与决策记录 |

目录划分表示代码职责，不要求每个目录独立发布或部署。Python 模块以可安装包组织，避免依赖运行目录或手动修改导入路径；包边界由工程设计确定。

## 4. 依赖关系

```text
tui --------------------> local/api
web/app ----------------> web/api + web/ui
web/api ----------------> local/api
desktop/renderer -------> web/app
desktop/main -----------> 本地服务生命周期
                                |
                                v
                             local/api
                                |
                                +----> local/access
                                +----> local/executor ----> local/tools
                                +----> local/storage
                                +----> local/logger
                                +----> cloud/api
                                           |
                                           v
                                      cloud/agent
                                           |
                                           v
                                      cloud/storage
                                           |
                                           v
                                 cloud/db + cloud/schema

local 与 cloud 的网络边界使用 shared/contracts
local 的系统能力通过 local/platform 适配
```

模型供应商适配由 cloud/agent 内部承担，不通过历史 providers 占位模块调用。cloud/api 和 storage 按需使用 cache；容器、配置、中间件和日志等横切依赖未在图中穷举。所有模块遵循以下约束：

- TUI、Web 和 Electron 不直接调用云端业务接口。
- 本地工具不依赖界面，不执行 LLM 推理。
- 云端不直接操作用户电脑上的工作区。
- 共享模块不引入本地或云端的内部业务实现。
- TUI 使用终端组件，Web 与 Electron 使用 DOM 组件，不跨渲染器复用界面组件。
- 本地与云端分别管理存储和迁移，日志不替代可靠业务状态。

## 5. 文档与实现衔接

后续设计按 tui、web、desktop、local、cloud、shared 和 engineering 等大模块分别补充；需要时再拆分子模块设计。本文不预设子模块内部目录、接口和实现方式。

当前云端已包含用户认证、数据库及缓存代理、消息存储、模型适配与 Agent 循环，以及 HTTP/SSE 接口。本地 gateway 已实现固定云端的 HTTP/SSE 转发、来源校验及请求日志；工具执行、审批和恢复状态尚未接入。用户端仍需依据实际代码确认完成度，不因目录存在而视为可运行。

云端连接与存储的职责衔接如下：

- api 将 SSE 订阅和消息提交分开，连接标识与业务会话标识独立；提交后由后台任务调用 agent，将输出经连接队列推送。
- agent 负责推理及工具编排；远程工具请求返回客户端，结果经后续请求提交，支持多轮对话及同轮多个工具调用。
- storage 负责原始消息和会话上下文持久化；结束事件通过异步后台任务保存。连接状态只保留必要轻量元数据，不缓存完整提交请求。
- 当前 SSE 连接队列为进程内实现，仅支持单 worker；跨进程分发、消息补发及断线恢复尚未实现。心跳、退避和清理细节在云端模块设计中维护。
- tests 中真实 API 测试需单独启动服务；与本地数据库测试、真实模型调用测试区分执行。测试规范见 [云端协作规范](../cloud/AGENTS.md)，启动及测试命令见 [云端构建说明](../cloud/BUILD.md)。

后续按模块设计逐步实现，避免为规划内容批量创建无用途目录；已有占位文件在添加实现后按需移除。
