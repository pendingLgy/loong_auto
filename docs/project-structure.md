# 工程模块结构

版本：v0.1 草案  
日期：2026-11-10  
关联文档：[整体架构](architecture-design.md)、[技术栈](technology-stack.md)

## 1. 范围

工程采用 Monorepo，统一管理 TUI、Web、Electron、本地服务和云端服务。本文仅定义工程模块及其下一层子模块，不展开文件、类、接口和内部实现。

用户端仅包含 TUI、Web 和 Electron。所有业务操作通过 Python 本地网关访问云端，通信采用 HTTP + SSE。

## 2. 工程目录

以下目录骨架已创建，子模块使用 .gitkeep 占位，尚未添加业务实现或依赖配置。顶层为工程模块，下一层为子模块；子模块内部结构由各模块设计文档补充。

```text
loong_auto/
├── tui/                        # 终端交互模块
│   ├── app/                    # 应用入口与生命周期
│   ├── views/                  # 终端视图
│   └── components/             # 终端交互组件
├── web/                        # 浏览器界面模块
│   ├── app/                    # 应用入口与路由
│   ├── pages/                  # 业务页面
│   └── assets/                 # Web 静态资源
├── desktop/                    # Electron 桌面模块
│   ├── main/                   # 桌面宿主与本地服务管理
│   ├── preload/                # 受限宿主接口
│   └── renderer/               # 共享 Web 界面的桌面入口
├── local/                      # Python 本地服务模块
│   ├── gateway/                # 本地接口、云端转发与事件分发
│   ├── executor/               # 工具调度与执行生命周期
│   ├── tools/                  # Shell、文件、搜索与 Git
│   ├── access/                 # 本地认证、权限与审批
│   ├── storage/                # 本地状态与迁移
│   ├── logger/                 # 本地业务日志
│   └── platform/               # 系统进程、凭证与路径适配
├── cloud/                      # Python 云端服务模块
│   ├── server/                 # API、事件与连接服务
│   ├── agent/                  # Agent 与任务编排
│   ├── providers/              # 模型供应商适配
│   ├── identity/               # 用户与设备身份
│   └── storage/                # 云端状态与迁移
├── shared/                     # 共享能力模块
│   ├── contracts/              # 协议定义、Schema 与生成类型
│   ├── client/                 # TypeScript 本地服务 SDK
│   └── ui/                     # Web 与桌面共享 DOM 组件
├── engineering/                # 工程与交付模块
│   ├── workspace/              # 跨模块工程配置
│   ├── scripts/                # 开发与生成脚本
│   ├── tests/                  # 跨模块集成与端到端测试
│   ├── packaging/              # 本地程序与桌面打包
│   └── deployment/             # 云端部署配置
└── docs/                       # 设计文档模块
    ├── modules/                # 后续模块设计文档
    └── decisions/              # 架构决策记录
```

现有架构、技术栈和本文保留在 docs 根目录。根级 workspace、锁文件等不在模块目录树中展开；Python 使用 uv workspace，TypeScript 使用 Bun workspaces，具体配置在工程设计中确定。

## 3. 模块边界

| 工程模块 | 技术方向 | 职责边界 |
| --- | --- | --- |
| tui | TypeScript、SolidJS、@opentui/solid、Bun | 终端界面，通过共享客户端访问本地服务 |
| web | TypeScript、SolidJS、Effect、Vite | 浏览器界面，并提供桌面共享界面能力 |
| desktop | Electron、TypeScript | 桌面宿主，启动或复用本地网关 |
| local | Python、uv | 本地网关、权限、执行、日志与状态管理 |
| cloud | Python、uv | 云端接入、推理、任务编排和持久化 |
| shared | Python 契约与 TypeScript 客户端、组件 | 共享跨端契约、客户端能力及 DOM 组件 |
| engineering | 工程配置与自动化工具 | 开发、验证、打包与部署支持 |
| docs | Markdown | 架构、模块设计与决策记录 |

目录划分表示代码职责，不要求每个目录独立发布或部署。Python 模块以可安装包组织，避免依赖运行目录或手动修改导入路径；包边界由工程设计确定。

## 4. 依赖关系

```text
tui --------------------> shared/client
web --------------------> shared/client + shared/ui
desktop/renderer -------> Web 共享界面
desktop/main -----------> 本地服务生命周期
                                |
shared/client ------------------+----> local/gateway
                                          |
                                          +----> local/access
                                          +----> local/executor ----> local/tools
                                          +----> local/storage
                                          +----> local/logger
                                          +----> cloud/server
                                                     |
                                                     v
                                                cloud/agent
                                                  |      |
                                                  v      v
                                          cloud/providers  cloud/storage

local 与 cloud 的网络边界使用 shared/contracts
local 的系统能力通过 local/platform 适配
```

身份、权限和日志等横切依赖未在图中穷举。所有模块遵循以下约束：

- TUI、Web 和 Electron 不直接调用云端业务接口。
- 本地工具不依赖界面，不执行 LLM 推理。
- 云端不直接操作用户电脑上的工作区。
- 共享模块不引入本地或云端的内部业务实现。
- TUI 使用终端组件，Web 与 Electron 使用 DOM 组件，不跨渲染器复用界面组件。
- 本地与云端分别管理存储和迁移，日志不替代可靠业务状态。

## 5. 文档与实现衔接

后续设计按 tui、web、desktop、local、cloud、shared 和 engineering 等大模块分别补充；需要时再拆分子模块设计。本文不预设子模块内部目录、接口和实现方式。

当前已按本结构生成目录骨架，后续按模块设计逐步添加实现；目录中的 .gitkeep 可在添加实际文件后移除。
