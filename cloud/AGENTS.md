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
│   ├── providers/     # 模型供应商适配
│   ├── agent/         # 模型调用契约与供应商协议适配器
│   ├── storage/       # 云端状态存储
│   ├── cache/         # 异步缓存代理、后端契约与 SQLite 实现
│   └── utils/         # 通用辅助能力
└── tests/             # 云端模块测试
```

- 应用装配与启动入口位于 `src/loong_cloud` 包根目录。
- `container.py` 使用 dependency-injector 统一装配应用级单例，通过 `app.state.container` 保存容器；各模块依赖入口从容器获取服务，普通类不访问全局容器，继续使用构造函数注入。测试可使用 provider.override 替换实现。容器不自动启动连接，启动和关闭仍由应用 lifespan 管理。
- HTTP 依赖按模块放在各自的 `dependencies.py` 中：`db` 提供数据库代理，`cache` 提供缓存代理，`storage` 提供用户存储，`core` 提供令牌服务。接口从对应模块导入依赖，代理实例由应用管理生命周期，普通存储类采用构造函数注入。中间件不使用 FastAPI 的依赖解析。
- 目录存在不代表功能已实现；`agent`、`server` 等历史占位目录不作为新增实现依据，按当前需求逐步完善。
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
- 登录会话同时缓存公开用户信息（id、username、name、role），通过字段白名单排除密码及密码哈希；认证后可从 `request.state.identity["user"]` 获取登录时的用户快照，用户状态仍查库校验。
- `POST /api/auth/refresh_token` 使用刷新令牌换取新的 access token，撤销旧 access token，refresh token 保留原有效期；刷新时重新校验用户状态。

## 测试执行

- 模型适配器位于 `agent/adapters`，统一使用 `agent/models.py` 的数据模型；通过 `create_adapter` 创建，使用异步上下文或 `close()` 释放自有 HTTP 客户端。外部注入的客户端由调用方关闭。
- `agent/executor.py` 的 `ModelExecutor` 通过 `execute(model_name, request)` 按 `GlobalConfig.models` 别名选择适配器并复用 HTTP 客户端。支持异步上下文和显式 `close()`，关闭前由调用方结束在途请求；仅路由模型调用，不执行工具。不应递归扫描整个 agent 包注册服务（包内含数据模型和适配器），需要注入时显式注册执行器类。
- DeepSeek 使用 `provider: deepseek`，默认地址 `https://api.deepseek.com/v1`，复用 OpenAI 兼容协议及本地/远程工具分类，调用时必须提供 API 密钥。当前仅支持已有普通调用契约，不支持推理模型专用的 reasoning_content 回传。

- 仅在用户明确要求时新增测试用例；修改代码后可以运行已有测试进行验证。

- 模型执行器 `stream()` 返回 text_delta、tool_call、done 事件；`stream_sse()` 返回可用于 StreamingResponse 的 SSE 帧。done 携带完整响应；中断流抛出 ModelError，不伪造完成。调用方提前停止消费时应使用 contextlib.aclosing 关闭生成器；HTTP 路由负责流开始后的错误事件策略。



- 同一供应商下所有模型共用供应商级 adapter，执行器按 provider 缓存适配器实例。model 和 temperature 每次调用独立传入，不修改共享实例配置，避免并发串扰；YAML 的 adapter 位于供应商层。

- 供应商连接统一由 adapters/default_models.yaml 维护，不设 config_provider.py 或 GlobalConfig.providers。密钥由每次调用的 ModelConfig.api_key 传入；ModelExecutor() 自动加载目录，同一供应商复用适配器。

- API 密钥使用 ModelConfig.api_key（SecretStr）按调用传入，适配器生成请求头时读取本次配置，不保存到供应商连接或共享客户端默认请求头。缓存适配器不保留用户密钥。


- AgentLoop 是每次请求创建的简单消息循环：run 接收消息历史，local 调用注入函数，remote 返回 tool_calls 事件并结束本次调用；调用方保存返回的 messages，下次追加工具结果消息后调用新实例。
