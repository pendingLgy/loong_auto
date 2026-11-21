# 云端模块协作规范

本文件适用于 `cloud` 目录及其子目录，与仓库根目录的 `AGENTS.md` 一并遵循。

## 项目结构与文档

修改前按需阅读 [整体架构](../docs/architecture-design.md)、[技术栈](../docs/technology-stack.md) 和 [工程模块结构](../docs/project-structure.md)。启动、测试和依赖更新命令见 [BUILD.md](BUILD.md)。

以下为当前云端模块结构，源码采用 `src/loong_cloud` 包布局，目录仅展开到子模块：

```text
cloud/
├── src/loong_cloud/
│   ├── api/           # HTTP 接口与路由
│   ├── middleware/    # 请求上下文、认证及中间件装配
│   ├── config/        # 配置模型与统一加载入口
│   ├── core/          # 日志、异常及核心基础能力
│   ├── common/        # 公共响应等通用定义
│   ├── constant/      # 缓存 key 等常量定义
│   ├── db/            # 数据库代理、实现及注册
│   ├── schema/        # 云端内部数据模型
│   ├── exception/     # 异常定义
│   ├── agent/         # 模型调用契约与供应商协议适配器
│   ├── storage/       # 云端状态存储
│   ├── cache/         # 异步缓存代理、后端契约与 SQLite 实现
│   └── utils/         # 通用辅助能力
└── tests/             # 云端模块测试
```

- 应用装配与启动入口位于 `src/loong_cloud` 包根目录。
- `container.py` 使用 dependency-injector 统一装配应用级单例，通过 `app.state.container` 保存容器；各模块依赖入口从容器获取服务，普通类不访问全局容器，继续使用构造函数注入。测试可使用 provider.override 替换实现。容器不自动启动连接，启动和关闭仍由应用 lifespan 管理。
- API 当前通过 `@inject` 和 `Depends(Provide["服务类名"])` 获取容器服务，注册与 wiring 目标由 `install_setting.py` 维护。中间件在装配时获取服务实例，不使用 FastAPI 的依赖解析；普通业务类使用构造函数注入。
- 目录存在不代表功能已实现，按当前源码确认职责；Agent 调用与循环已有实现，不再作为空占位模块描述。
- API 请求与响应契约优先放在 `shared/contracts`，云端内部模型放在 `schema`，避免重复定义跨模块契约。
- 接口按业务模块拆分，统一使用 `/api` 公共前缀和模块前缀；中间件、配置和数据库逻辑放在各自模块。
- 云端负责推理与编排，本地工具执行仍由用户本地网关负责，不在云端直接操作用户工作区。
- 结构调整时同步检查本文与工程模块结构文档；规划结构与实际实现不同，应明确标注，避免把规划写成已实现事实。


## 缓存

- 业务缓存 key 模板集中在 `constant/cache_key.py`，全局 prefix 由 `CacheProxy` 统一添加。

- HTTP 业务通过 `cache/dependencies.py` 注入缓存，普通服务通过构造函数接收缓存；配置由 `GlobalConfig.cache_config` 统一加载。
- 当前实现 SQLite，缓存独立于业务数据库，支持 JSON 值、命名空间及按秒设置的 TTL；过期数据读取为未命中，后台线程按 `cache_config.sqlite.cleanup_interval` 定时调度物理清理，也可调用 `cleanup_expired()`。线程随缓存启动和关闭，定时清理 SQL 在独立线程的事件循环中执行，使用专用引擎和 Session，不共享主循环连接及 asyncio 锁。
- 新后端继承 `BaseCache`，通过 `cache_registry` 注册并配置 `cache_type`；Redis 尚未实现。

## 用户认证

- 认证白名单支持大小写敏感的 glob 匹配，`*` 可跨 `/` 匹配任意长度路径；例如 `/api/status/*` 匹配子路径，不匹配 `/api/status` 本身，根路径需单独配置。未使用通配符的路径仍为精确匹配。

- `storage/user_store.py` 管理默认租户的注册、登录校验及用户查询，密码使用随机盐 PBKDF2-SHA256，响应不包含密码哈希。
- `api/login_api.py` 提供 `/api/auth` 下的注册、登录、当前用户及退出接口。
- JWT 通过 `token_config` 配置 HS256 密钥和有效期；真实密钥通过本地配置或环境变量注入，不提交仓库。
- 缓存保存令牌指纹、配对关系和会话标记；认证必须同时校验签名与缓存状态，退出撤销当前会话及配对令牌。
- 令牌 key 为 `prefix:{用户ID}:access_key:platform` 和 `prefix:{用户ID}:refresh_key:platform`（实际 key 保留用户 ID 两侧花括号，作为 Redis Cluster hash tag）；会话 key 同样包含该 hash tag，user_id 来自已验证 JWT 的 sub；缓存值保留令牌指纹和会话 ID，同一用户在同一平台重新登录使此前令牌失效，不同平台独立；platform 在登录时指定并写入 JWT，刷新时从已验证 JWT 读取。
- 登录会话同时缓存公开用户信息（id、username、name、role），通过字段白名单排除密码及密码哈希；认证后从 `request.state.identity`（`UserInfoResponse`）获取公开用户信息，用户状态仍查库校验。
- `POST /api/auth/refresh_token` 使用刷新令牌换取新的 access token，撤销旧 access token，refresh token 保留原有效期；刷新时重新校验用户状态。

## 配置与数据库

- 配置文件放在 `config` 包，按 `config_xxx.py` 命名；配置模型的所有字段使用 Pydantic `Field` 定义。
- 配置统一通过 `GlobalConfig.load(path)` 加载，支持 `.env` 和 YAML；环境变量按固定前缀动态映射，不在各配置模型中自行读取环境变量，不硬编码逐字段解析。
- 数据库通过代理管理，业务代码使用 Session 上下文；按场景选择同步或异步、自动或手动提交事务。异步引擎及连接不能跨事件循环复用。
- 数据表由 `schema` 统一定义及注册。新增字段需考虑已有数据库迁移，`create_all` 不会自动修改已有表。

## 模型与工具循环

- 模型协议适配器位于 `agent/adapters`，供应商目录位于 `default_models.yaml`。根据调用时的 provider/model 查目录，同一供应商下模型共用供应商级 adapter；不新增 `config_provider.py`。
- `ModelExecutor.complete(config, request)` 返回 `Message`，`stream(config, request)` 返回流式 `Message`。模型配置按调用传入，适配器按供应商复用；不要沿用旧的 `execute(model_name, request)` 或 `GlobalConfig.models` 别名接口说明。
- `Message` 保存原始响应、状态、结束原因和 token 用量；流事件格式以当前模型定义为准，不再约定旧的 text_delta/tool_call/done 包装。
- API 密钥以 `SecretStr` 随本次配置传入，不写入共享客户端默认请求头，不缓存到供应商目录或 SSE 会话元数据；日志不得输出密钥。
- 执行器支持异步上下文及 `close()`；外部传入的 HTTP 客户端由调用方关闭。提前停止消费异步生成器时使用 `aclosing`。
- `AgentLoop` 每次请求创建，通过 `run`、`run_stream`、`run_sse` 执行；`local_executor` 为工具名到异步函数的映射，不恢复单个执行器或集合形式。
- local 工具在当前执行节点处理，remote 工具返回客户端执行；这两个标记相对于当前执行节点，不代表云端可以直接访问用户本地工作区。
- 同轮先执行所有 local 工具，再返回 remote 调用并结束本次 loop；下一次请求携带工具结果继续，不新增 resume 或跨请求复用 loop 实例。
- `LoopEvent` 的 `tool_calls` 保存原始调用顺序，`tool_call_messages` 保存结果，`remote_tool_calls` 保存待客户端执行的调用。追加工具结果时按 `tool_calls` 顺序匹配 `tool_call_id`，不能按工具完成顺序拼接。

## SSE 连接与消息存储

- `message_api.py` 提供直接聊天流及查询；`events_api.py` 将长连接订阅与消息提交拆开，路由分别为 `GET /api/events/chat/{client_id}/sse` 和 `POST /api/events/chat/{client_id}/working-directories/{working_directory_id}/messages`。
- `client_id` 标识连接，提交 body 的 `session_id` 标识业务对话，两者不能混用。连接按租户、认证用户和 client_id 隔离；身份字段取认证上下文，不信任客户端提交值。
- 客户端先订阅再提交。一次连接可以承载多轮请求；同一连接执行期间拒绝并发提交，对话结束后 SSE 继续保持连接。
- `EventSession` 使用有界队列和进程内状态，当前仅支持单 worker，不支持跨进程分发、持久化事件补发或断线续传。
- 空闲时定时推送 heartbeat；发送超时与异常采用指数退避，次数、间隔和超时以源码常量为准。收到明确 `http.disconnect` 时立即清理，不进入退避；ASGI 无法仅凭此事件区分主动关闭和网络中断。
- 发送成功只代表服务端接受写入，不代表客户端收到；当前没有心跳 ACK。测试客户端关闭 socket 可能发送 FIN/RST，不能将其宣称为网络黑洞测试。
- 连接清理负责移除 EventSession、取消对话任务和清空队列。断连监听不能与生成器同时竞争消费 ASGI receive。
- `stop` 事件通过独立 asyncio 后台任务调用 `on_stop` 保存最终 assistant 消息，不阻塞推送、不随发送重试重复保存；保存失败记录日志堆栈。连接结束时等待已提交的保存任务完成，再清理依赖的会话数据。
- 不使用完整 `AddMessageRequest` 或 submissions 缓存消息历史、工具和密钥；保存元数据只保留会话标题、供应商和模型等必要小字段，使用后移除。
- `message` 表保存原始消息及 LLM 原始响应；`session_message` 每个 tenant_id/user_id/session_id 一条记录，以 JSON 字段维护 LLM 上下文。上下文压缩指语义压缩，不是字节压缩。
- API 请求与响应类型放在 `shared/contracts`，不得依赖 `loong_cloud.agent`。将契约转换为内部 Message 时显式校验，避免依赖模糊 dict；工具调用字典与模型对象的序列化方式需与实际类型一致。

## 测试与交付

- 仅在用户明确要求时新增测试；修改后运行相关已有检查，不主动执行依赖管理命令，不生成未要求的 README。
- pytest 异步支持由根配置中的 `asyncio_mode = "auto"` 提供。测试依赖通过 cloud 的 `test` extra 声明；命令见 [BUILD.md](BUILD.md)。
- `test_message_api.py`、`test_events_api.py` 为真实 HTTP 集成测试，需要单独启动服务；SSE 测试使用单 worker，不用进程内 ASGITransport 替代真实服务。
- API 测试复用配置及登录 fixture，从 `cloud/.env.api_key` 获取配置；缺少 access token 时登录并更新配置中的 token 与时间注释。不要打印认证头、token 或模型密钥。
- 每个测试独立定义请求 body，使用接口契约类构造，再转换为 JSON；`SecretStr` 默认脱敏，实际 HTTP 提交时显式取出本次密钥，不打印请求凭证。
- 模型与工具集成测试使用真实业务调用，不引入 mock 或 monkeypatch 模拟调用。测试会产生模型费用并保留会话记录，缺少模型密钥时跳过相关用例。
- 多轮工具测试应检查调用批次、先后顺序、参数依赖、结果回传及最终回答；同轮多个工具结果按原始调用顺序回传。
- 测试临时文件执行完成后清理；真实服务测试数据与临时文件区分处理，不默认删除业务数据。
- 明确区分语法检查、导入检查、测试收集和实际执行；仅完成 collect-only 时不能宣称测试通过。真实网络退避行为需按实际故障条件验证。
