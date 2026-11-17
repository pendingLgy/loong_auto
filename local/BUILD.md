# 本地网关构建与运行

在仓库根目录执行。网关以单进程运行，仅监听本机，cloud 需要单独启动。

## 依赖、启动与构建

```powershell
uv sync --package loong-local
uv run --package loong-local python -m loong_local --path local/.env
# 或使用 YAML
uv run --package loong-local python -m loong_local --path local/config.example.yaml
uv build --package loong-local
```

先复制 [.env.example](.env.example) 为 .env 并修改，或使用 [YAML 示例](config.example.yaml)。LOCAL_ 环境变量优先于文件，文件优先于默认值。仅支持 .env、.env.*、.yaml、.yml，未指定路径时只读取环境变量及默认值。本次未执行依赖管理命令。

## 模块与接口

- `api/proxy_common_api.py`：普通 `/api/...` 透明转发。
- `api/proxy_message_api.py`：`POST /api/events/chat/{client_id}/messages`，校验身份、持久化提交；当前会话待审批自动拒绝，补齐工具消息后提交。
- `api/proxy_sse_api.py`：`GET /api/events/chat/{client_id}/sse`，持久化事件订阅，支持 Last-Event-ID。
- `api/approval_api.py`：审批查询、决定、凭证恢复与提交核对。
- `middleware/session.py`：每个请求创建 `Request(scope)`，只保存 `request.state.sse_context`。
- `services/gateway.py`：应用编排、后台执行及 `client.events.submit` 续传。
- `storage/approval_store.py`：SQLite 事务存储，使用有类型的 OwnerState JSON 载荷，当前按用户保存聚合记录。
- `tools`：ABSTool 抽象接口、类型化注册表、命令工具和风险规则。

业务数据使用 Pydantic 模型和 dataclass；工具 arguments 等通用 JSON 沿用 shared 契约，并在工具边界转换为具体请求模型。ASGI scope、HTTP 头和 JSON 序列化采用框架要求的容器。

消息提交返回 code=200 及 submission_id/status，表示已经本地持久接收，不表示 cloud 已执行。每条消息必须有稳定 id；同批消息重复提交复用已有记录，不同内容复用相同 id 返回冲突。

路径 client_id 保留 SDK 兼容，实际上游统一使用 app 启动生成的 client_id。持久化 gateway_id 在首次创建数据库时生成，重启不变。多界面可消费同一已认证用户的事件，不重复建立 cloud 订阅。

## 审批与恢复

所有审批接口通过 cloud `/api/auth/me` 校验身份，不信任身份请求头，不将 Authorization 或模型 api_key 保存到数据库。

```text
GET  /local/v1/health
GET  /local/v1/approvals?session_id=...&status=PENDING&page=1&page_size=20
GET  /local/v1/approvals/{approval_id}
POST /local/v1/tools/{client_id}/approvals/{approval_id}   {"approved":true}
POST /local/v1/credentials                             {"session_id":"...","api_key":"..."}
GET  /local/v1/submissions?session_id=...
POST /local/v1/submissions/{submission_id}/resolve      {"received_by_cloud":true}
```

拒绝使用 approved=false。审批无自动过期，客户端断开不会取消待审批或后台执行。再次登录后可以查询、处理原 approval_id；模型密钥只存在内存，重启后需要通过 credentials 重新提供。凭证恢复接口需携带有效 Authorization。

新增工具继承 ABSTool 并加入 tools 注册表；不在 DANGEROUS_TOOLS 的工具直接执行，列入的工具由 is_dangerous 判断是否需要人工批准。模型声明不能绕过本地风险检查。工作目录不是 Shell 沙箱，命令具有当前进程权限。

SQLite 保存审批、工具批次、结果、提交记录和事件。重启将执行中的 RUNNING 标记 UNKNOWN，禁止自动重放。未知执行结果需要人工核对外部状态，当前未提供自动解除执行 UNKNOWN 的接口。

cloud 尚无 submission_id 幂等查询/确认接口。Idempotency-Key 随提交发送，但不能据此宣称 cloud 已实现幂等。网络错误或接收结果不明确时保存为 UNKNOWN，不自动重试；人工核对 cloud 后，resolve 指定已接收或未接收。后者只重新提交消息，不重跑已完成工具。

## 测试与限制

```powershell
uv run --package loong-local python -m pytest local/tests/test_auth_api.py -v
```

已有 tests 目录保留。真实测试需要先启动 local/cloud 并配置 local/.env.test。旧工具/事件测试仍使用已移除的 MessageRequest 和旧 client_id 断言，需单独迁移后运行；本次没有新增测试文件或改写这些用例。

当前实际检查包括语法、应用组装、临时 SQLite 审批恢复、自动拒绝和有序补齐等，不代表真实模型联调通过。SQLite 当前按用户保存聚合 JSON 和历史事件，事件保留清理、大数据分页优化、跨进程部署尚未实现。cloud 连接错误不自动重连，需要新的认证请求或重新订阅；运行中模型任务在 cloud 断线后的恢复仍取决于 cloud 能力。

日志包含包路径、方法、行号、线程及 cloud 请求上下文（透明转发），不输出认证头和消息正文，异常日志关闭 diagnose，避免打印局部凭证。

## 依赖注入

local 使用 dependency-injector 的 ApplicationContainer，容器保存在 app.state.container。装配顺序为 GatewayConfig → SQLiteDatabase → ApprovalStore → GatewayService，使用应用级 Singleton；HTTP 客户端进入 lifespan 后注入 CloudClient，退出时先关闭后台服务，再关闭 HTTP 客户端。

中间件通过容器获取 GatewayService 并放入请求 SSEContext。普通业务类只通过构造函数接收依赖，不引用全局容器。数据库 Provider 不主动连接或启动，ApprovalStore.start() 仍由 lifespan 调用；SQLite 每次操作使用独立连接，不跨线程共享连接。

替换数据库可在仓库服务首次解析前执行 container.db.override(providers.Object(database))。测试或自定义装配还可替换 approval_store 和 cloud_client Provider。本次仅补充依赖声明，未运行 uv sync 或修改锁文件。
