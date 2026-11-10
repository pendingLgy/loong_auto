# 云端基础实现

当前包含设备认证、任务创建、幂等检查、工具往返、取消、SQLAlchemy 持久化，以及可按游标恢复的 SSE。云端不执行 Shell。

## 启动配置

在已同步云端包依赖的环境中配置以下环境变量，再使用 `uv run --package loong-cloud loong-cloud` 启动。配置值不得提交仓库。

| 环境变量 | 含义 |
| --- | --- |
| CLOUD_DEVICE_TOKENS | JSON 对象：设备令牌映射到 `{"user_id":"用户ID","device_id":"设备ID"}` |
| MODEL_BASE_URL | Chat Completions 兼容服务根地址，通常包含 /v1 |
| MODEL_API_KEY | 模型密钥 |
| MODEL_NAME | 模型名称 |
| DATABASE_URL | SQLAlchemy URL，默认 sqlite:///loong-cloud.db |

PostgreSQL 可使用 `postgresql+psycopg://...`，需具备声明的 postgres 可选依赖。当前仓库没有执行任何依赖安装或锁定命令。

## 接口

健康检查与服务状态接口无需认证，其他接口使用设备 Bearer 凭证。接口仅面向本地网关，浏览器和 TUI 不应直接访问。

```text
GET  /api/status/health
GET  /api/status
POST /api/tasks
GET  /api/tasks/{task_id}
POST /api/tasks/{task_id}/cancel
GET  /api/events
GET  /api/events/tasks/{task_id}
```

网关持续订阅 `/api/events`，根据 `tool.request` 在本地完成参数与权限校验后执行，再提交工具结果。SSE 支持 Last-Event-ID 或 after，事件 ID 为设备可见的全局递增游标，允许不连续。

工具结果重复提交且内容一致时返回成功，内容冲突返回 409。unknown 结果会停止任务，避免模型猜测执行情况。取消事件表示停止推进，本地网关仍需负责清理活动进程；已发生的副作用不会撤销。

## 当前边界

- 仅支持单服务实例、单 worker；跨实例任务 lease 与连接路由尚未实现。
- 使用显式 Agent 循环和 Chat Completions 适配，尚未引入 PydanticAI。
- 模型响应目前按完整轮次输出 `model.text`，不是 token 流；SSE 本身持续推送任务事件。
- 开发初始化使用 create_all；正式数据库迁移、用户登录和设备注册撤销仍待实现。
- 工具 schema 作为模型定义发送；本地执行器必须进一步校验工具参数与审批。
- 结果输出长度有限制，但尚未提供分块上传、工具等待期限、事件清理和上下文压缩。
- 任务重启恢复会重新发起中断的模型请求，可能产生重复模型费用；不会自动重新执行等待中的工具。
- 生产发布前需补齐上述能力、TLS、限流、审计与备份，不应直接作为多租户生产部署。

验证：`uv run --package loong-cloud python -m unittest discover -s engineering/tests -v`。测试使用临时 SQLite 和假模型，不调用真实模型或本地 Shell。

## 统一响应

## 认证中间件

AuthenticationMiddleware 统一校验 Bearer 设备令牌，并将身份写入 request.state.identity，包含 user_id 和 device_id。当前复用静态 TokenRegistry，尚未对接用户登录或 JWT。RequestContextMiddleware 在认证之前执行，认证失败返回统一 401 响应和请求上下文头。

使用 CLOUD_AUTH_PUBLIC_PATHS 配置无需认证的完整路径 JSON 数组，示例见 cloud/.env.example。未配置时默认放行状态、健康检查、API 文档与 OpenAPI；配置值替换默认列表，[] 表示无白名单。不支持通配符或前缀匹配。业务路由自身的身份依赖仍会阻止匿名操作，即使误加入白名单也不会绕过任务归属检查。

普通 HTTP 接口使用 shared/contracts 的 BaseResponse 泛型：code、msg、data、request_date、request_id。成功 code 为 0，失败 code 使用 HTTP 状态码，HTTP 状态码保留原语义；request_date 为请求接收时的 UTC 时间，request_id 与 X-Request-ID 一致。SSE 保持事件流格式，文档和 OpenAPI 端点保持框架格式。

工具结果提交路由已移除，Agent 内部处理方法暂保留；当前不支持通过 HTTP 完成工具往返。engineering/tests 中依赖旧路由的集成测试待后续任务接口设计时调整。

## 当前精简状态

Agent 实现已移除，应用不再初始化模型客户端或恢复 Agent 任务，启动无需模型配置。tasks 目前仅保留 GET /api/tasks/demo；不提供创建、查询、取消任务及工具结果提交接口。模型适配和存储代码保留供后续设计使用。

Repository 实现及其启动依赖已移除，应用不再连接或初始化数据库。依赖该实现的事件接口同步移除，当前仅提供状态、健康检查与任务 demo 接口。存储目录仅作为后续设计预留。
