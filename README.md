# Loong Auto

云端推理，本地执行的 Vibe Coding 平台。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-%3E%3D3.12-3776AB?logo=python&logoColor=white)](pyproject.toml)

Loong Auto 采用 Monorepo 组织云端服务、本地网关与用户界面。目标是让 TUI、Web 和 Electron 共享任务能力，由云端负责 LLM 调用与任务编排，由本地网关管理授权、工具执行、日志和本地状态。

> 项目正在开发中。当前重点是云端基础能力；完整的模型编排、本地执行链路和多端界面仍在逐步建设，目录与技术规划不代表功能已全部实现。

## 功能进展

| 模块 | 当前情况 |
| --- | --- |
| 云端 API | 已有状态查询、注册、登录、用户信息、退出及 token 刷新接口 |
| 认证与配置 | JWT、密码哈希、认证白名单、环境变量及 YAML 配置 |
| 基础设施 | 异步数据库代理、SQLite 缓存、TTL 清理、依赖注入及请求上下文日志 |
| 本地网关与工具 | 规划与工程骨架，持续建设中 |
| TUI / Web / Electron | 技术选型与工程组织已规划，持续建设中 |
| LLM 与任务编排 | 后续实现 |

## 整体架构

```text
TUI / Web / Electron
          |
          v
    Python 本地网关
      |           |
      |           +--> 权限审批 --> 本地工具 --> 用户工作区
      |           +--> 本地日志与状态
      |
      | HTTP / HTTPS + SSE
      v
    Python 云端服务
      +--> 任务与上下文编排 --> LLM 供应商
      +--> 用户认证 / 数据库 / 缓存
```

所有用户端业务请求经过本地网关访问云端。云端不直接操作用户工作区，本地保留工具执行的最终授权权力。通信采用 HTTP / HTTPS 与 SSE。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 云端 | Python、uv、FastAPI、SQLAlchemy、SQLite、Loguru、dependency-injector、PyJWT |
| 本地服务（规划） | Python、asyncio、HTTP / SSE |
| TUI（规划） | TypeScript、SolidJS、@opentui/solid、Bun |
| Web（规划） | TypeScript、SolidJS、Effect、Vite、Bun |
| 桌面（规划） | Electron，共享 Web 界面 |
| 共享契约 | Pydantic、OpenAPI |

## 快速开始

以下命令在仓库根目录的 PowerShell 中执行，需要 Python 3.12+ 和 [uv](https://docs.astral.sh/uv/)。

### 1. 准备环境

```powershell
uv sync --package loong-cloud
Copy-Item cloud/.env.example cloud/.env
```

已有 `cloud/.env` 时保留现有文件，按示例补充配置即可。编辑 `.env`，设置本地 JWT 签名密钥：

```dotenv
# 使用至少 32 字符的随机密钥，不提交真实密钥
LOONG_TOKEN_CONFIG__SECRET=replace-with-your-own-random-secret-at-least-32-characters
```

默认使用 SQLite 数据库与文件缓存，相关目录需可写。缓存与数据库相对路径以进程工作目录为基准。

### 2. 启动云端

```powershell
uv run --package loong-cloud python -m loong_cloud --path cloud/.env
```

也可以使用 YAML：

```powershell
uv run --package loong-cloud python -m loong_cloud --path cloud/config.example.yaml
```

YAML 示例未包含实际密钥，启用登录前需配置 `token_config.secret`，或设置 `LOONG_TOKEN_CONFIG__SECRET` 环境变量。监听地址与端口以 [启动入口](cloud/src/loong_cloud/startup.py) 为准。

### 3. 运行已有测试

```powershell
uv run --package loong-cloud python -m unittest discover -s cloud/tests -v
```

仅运行配置加载测试：

```powershell
uv run --package loong-cloud python -m unittest discover -s cloud/tests -p "test_loading_config.py" -v
```

项目持续开发中，运行结果以当前代码和本地环境为准。

## 配置

配置入口为 `GlobalConfig`，支持 `.env`、`.yaml` 和 `.yml`。环境变量使用 `LOONG_` 前缀，双下划线 `__` 表示嵌套层级。

```dotenv
LOONG_LOG_LEVEL=INFO
LOONG_CACHE_CONFIG__CACHE_TYPE=sqlite
LOONG_CACHE_CONFIG__PREFIX=loong
LOONG_CACHE_CONFIG__SQLITE__DATABASE=loong-cache.db
LOONG_TOKEN_CONFIG__ACCESS_TTL=3600
LOONG_TOKEN_CONFIG__REFRESH_TTL=604800
```

进程环境变量可覆盖文件配置。完整示例见 [环境变量配置](cloud/.env.example) 和 [YAML 配置](cloud/config.example.yaml)。真实密钥、运行日志及数据库文件不应提交到仓库。

## 工程结构

```text
loong_auto/
├── cloud/          # Python 云端服务
├── local/          # Python 本地网关与工具
├── tui/            # 终端界面
├── web/            # 浏览器界面
├── desktop/        # Electron 桌面端
├── shared/         # 共享契约、客户端与组件
├── engineering/    # 工程与交付配置
└── docs/           # 架构与设计文档
```

Python 使用 uv workspace 管理，根 `pyproject.toml` 统一约束版本，各子包声明实际依赖，共用 `uv.lock`。

## 文档与参与开发

- [整体架构](docs/architecture-design.md)
- [技术栈规划](docs/technology-stack.md)
- [工程模块结构](docs/project-structure.md)
- [云端启动与测试命令](cloud/BUILD.md)
- [项目协作规范](AGENTS.md)
- [云端协作规范](cloud/AGENTS.md)

欢迎通过 Issue 讨论需求或问题，通过 Pull Request 提交改进。开发前请阅读对应模块规范，保持改动范围清晰，并说明验证结果。部分规划文档保留历史选型，当前架构边界以整体架构和协作规范为准。

## 许可证

本项目使用 [MIT License](LICENSE)。
