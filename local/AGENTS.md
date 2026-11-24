# local 协作规范

本文作用于 `local/`，补充根目录 [AGENTS.md](../AGENTS.md)。

## 职责边界

- `local` 是运行在用户本机的 Python 网关，负责连接云端、转发业务请求、维护 SSE 订阅、执行本地工具和处理工具审批。
- 界面层（Web / Electron / TUI）通过 local 的 HTTP / SSE 接口访问云端，不直接连接云端业务接口。
- 云端负责模型推理与编排；local 不实现 LLM 推理，不自行改写模型返回的工具调用。
- local 管连接、审批、工具执行和本地配置；不承担界面渲染。
- 工具执行保留最终授权权，模型或云端不能绕过 local 的风险检查。

## 目录约定

```text
local/
├── src/loong_local/
│   ├── api/           # HTTP / SSE 接口与云端转发
│   ├── commons/       # 常量与请求头重建
│   ├── config/        # GlobalConfig、GatewayConfig、DB 配置
│   ├── core/          # 容器、请求上下文、日志、锁与异常
│   ├── db/            # SQLite 访问
│   ├── middleware/    # 请求上下文、会话、访问控制
│   ├── schema/        # 内部数据模型与表定义
│   ├── service/       # 审批、待处理工具任务、会话/供应商配置
│   ├── tools/         # 工具抽象、注册表、执行器、文件/命令工具与安全策略
│   ├── app.py         # 应用装配
│   └── startup.py     # 启动入口
├── tests/             # 真实 HTTP 集成测试
├── BUILD.md           # 构建与运行说明
└── path_secutiry.md   # 路径安全说明
```

- API 路由按业务模块放 `api/`；跨模块的请求/响应契约优先放在 `shared/contracts`。
- 业务服务放 `service/`；数据库表与查询放 `db/`、`schema/`；不要在 API 中堆叠持久化细节。
- 工具按类别放 `tools/filesystem`、`tools/shell`；新增工具必须注册，不能绕过注册表直接暴露命令。
- 安全策略集中在 `tools/security/`，不要在各工具中重复实现路径或权限判断。

## 配置

- 统一通过 `GlobalConfig.load(path)` 加载；启动必须传入 `--path`。
- `.env` 使用 `LOONG_` 前缀，嵌套字段用 `__`；YAML 使用模型字段结构。
- 优先级：进程环境变量 > 文件中的前缀变量 > 默认值。
- `security_token` 为空时启动生成随机令牌；只有 `enable_security_token=true` 时才要求请求携带令牌。
- `enable_summary` 控制 SSE 结束后是否请求云端返回全量消息汇总；默认 `true`，关闭可降低带宽。
- 不在代码中写死 API 密钥、访问令牌或用户工作目录；本地数据库和 `.env` 不提交。

## 安全与审批

- 所有 HTTP 转发使用统一的 `CloudClient` 与请求头重建逻辑，不手工拼接认证头。
- 审批接口通过云端身份校验；不信任客户端自报身份。
- API 密钥只保存在内存或本地配置中，不写入审批记录、事件或日志。
- 文件工具必须使用 `PathGuard` / `ToolGuard` / 权限策略；命令工具使用当前进程权限，不宣称存在系统级沙箱。
- 危险工具在 `workspace_write` 等模式下需要人工审批；审批前不执行，审批后再落盘。
- 日志不得输出认证头、令牌、API Key 或完整消息正文。

## 开发与验证

在仓库根目录执行：

```powershell
uv sync --package loong-local
uv run --package loong-local python -m loong_local --path local/.env
uv run --package loong-local python -m pytest local/tests/test_auth_api.py -v
uv run --package loong-local python -m py_compile <changed_python_files>
uv build --package loong-local
```

- 修改 API、配置或工具后，至少执行语法检查；涉及真实 HTTP 的测试需要先启动 local/cloud 并配置 `local/.env.test`。
- 不在未启动服务时宣称集成测试通过；`collect-only` 只代表用例可收集。
- 真实模型/工具测试会产生费用并保留会话记录，缺少模型密钥时按测试约定跳过。
- 不主动执行依赖升级或生成未要求的文档；新增测试仅在用户明确要求时进行。
- 修改后同步检查 [BUILD.md](BUILD.md)、[path_secutiry.md](path_secutiry.md) 和接口契约是否仍然一致。
