# SSE 工具调用与人工审批设计

日期：2026-11-17  
实现更新：local 已按第 11 节重建，现有实现说明见 [local/BUILD.md](../local/BUILD.md)。前文连接内 Future 方案为历史原理，当前通过持久化状态与独立后台调度继续审批，不依赖旧 Future。cloud 幂等确认及执行 UNKNOWN 自动处置尚未实现。

范围：本地网关的事件转发、工具调度、风险检查、人工审批与结果续传。本文描述设计及当前代码的实现原理，不代表端到端联调已通过。

## 1. 职责与边界

云端调用 LLM，生成工具请求并编排对话。本地网关接收请求，判断权限、执行本机工具，并将结果发回 cloud。TUI、Web、Electron 展示调用内容和风险，接收用户决定，通过 HTTP 提交审批；执行进度和结果通过 SSE 推送。

`remote_tool_calls` 的 remote 相对于云端执行节点而言，在本方案中由用户本地网关执行。云端不会直接执行用户电脑上的命令。

```text
TUI / Web / Electron
       | HTTP 提交任务、审批
       | SSE 接收模型事件、工具请求和结果
       v
Python 本地网关
       +-- SessionMiddleware：构建请求上下文
       +-- proxy_sse：订阅、提交、关联工具会话
       +-- tool_handler：风险检查、审批等待、调度和续传
       +-- ABSTool 实现：本机实际操作
       |
       | HTTP 提交工具结果 / SSE 接收下一轮事件
       v
cloud Agent Loop --> 模型适配器 --> LLM
```

## 2. 完整流程图

```text
客户端建立 SSE 订阅
       |
       v
网关按认证信息 + app.client_id 创建 ToolSession
       |
       v
客户端提交消息 --> 登记本次模型配置等续传参数 --> cloud 执行 LLM
                                                              |
                         +------------------------------------+
                         v
                 网关接收完整 cloud SSE 帧
                         |
                         v
                 先转发原始事件给客户端
                 （客户端据此展示工具调用）
                         |
                         v
                 是否有 remote_tool_calls？
                    | 无              | 有
                    v                 v
                 继续转发      按数组顺序逐个处理工具
                                      |
                                      v
                       查询 TOOL_REGISTRY，解析工具参数
                                      |
                                      v
                         已有该 call_id 的结果？
                           | 是           | 否
                           v              v
                       复用结果    名称在 DANGEROUS_TOOLS？
                                     | 否            | 是
                                     |               v
                                     |       tool.is_dangerous(args)？
                                     |          | 否         | 是
                                     |          |            v
                                     |          |     推送审批事件并等待
                                     |          |       | 批准    | 拒绝
                                     +----------+-------+         |
                                                |                v
                                                v           生成失败结果
                                        执行工具，生成结果         |
                                                +----------------+
                                                |
                                                v
                                   保存到 tool_call_messages
                                                |
                                      继续处理剩余工具
                                                |
                                                v
                           按 tool_calls 的原始顺序合并全部结果
                                                |
                                                v
                             SSE 推送 tool_called 给客户端
                                                |
                                                v
                            client.events.submit 提交 cloud
                                                |
                                                v
                             cloud 开启新一次 Loop，继续返回事件
```

“先推送工具调用”通过转发 cloud 原始事件实现，原始事件中已经包含工具调用数组，无需再生成一份重复的工具调用事件。工具结果另用 `tool_called` 事件推送。

## 3. 人工审批时序

```text
客户端界面              本地网关 tool_handler      审批 HTTP 接口        cloud
    |                           |                      |                  |
    |<-- 原始工具调用事件 ------|<---------------------+------------------|
    |                           |                      |                  |
    |                           | 创建 approval_id     |                  |
    |                           | 保存 Future          |                  |
    |<-- tool_approval_required -|                      |                  |
    |                           |                      |                  |
    | 展示操作、目录、风险原因    | 等待 Future           |                  |
    |<-- heartbeat -------------|                      |                  |
    |                           |                      |                  |
    |---- approved=true ------------------------------>|                  |
    |                           |<-- set_result(true) --|                  |
    |<--- 审批已提交 -----------------------------------|                  |
    |                           |                      |                  |
    |                           | 唤醒并执行工具        |                  |
    |<-- tool_called -----------|                      |                  |
    |                           |---- events.submit --------------------->|
    |<-- 后续模型事件 ----------|<----------------------------------------|
```

审批接口返回“审批已提交”表示决定已送达等待方，不表示工具已执行成功。客户端以 SSE 的 `tool_called` 内容判断工具执行结果。

## 4. 上下文和会话

### 请求上下文

`SessionMiddleware` 对每个 HTTP 请求执行 `request = Request(scope)`，统一创建 `SSEContext`，只保存到 `request.state.sse_context`，不区分普通请求与 SSE 请求，不读取请求体。

| 对象 | 内容与用途 | 生命周期 |
| --- | --- | --- |
| `app.state.client_id` | 创建 app 时通过 `uuid_str()` 生成的网关实例标识 | app 生命周期，重启重新生成 |
| `SessionContext` | Authorization、tenant_id、user_id、client_id、platform、local_request_id；构建公共请求头 | 单次请求 |
| `SSEContext` | SessionContext、SDK、网关配置、日志、请求头、工具会话及其管理器 | 单次请求，SSE 持续到连接结束 |
| `ToolSessionManager` | 按 Authorization 和网关 client_id 关联订阅与后续提交、审批请求 | app 生命周期 |
| `ToolSession` | 待审批 Future、本次提交元数据、已完成工具结果 | 对应订阅连接 |

普通请求的 `SSEContext.tool_session` 可以为空。只有订阅入口创建并绑定工具会话。独立的审批 HTTP 请求通过管理器定位原 SSE 连接的会话，不依赖两个请求共享同一个 Request 对象。

请求结束时中间件调用 `release()`；流式响应结束路径也可以调用它。释放操作仅删除当前绑定的会话，并将引用清空，避免重复清理影响新连接。

Authorization 隐藏于上下文的 repr，不写入日志。tenant_id、user_id 等客户端请求头只是声明参数，不能代替认证或服务端授权校验。

### 工具执行上下文

`tool_handler` 从 `ToolSession.requests[session_id]` 取得继续调用模型需要的提交参数。登记时去掉历史 messages 和 tools；工具处理结束后以 assistant 工具调用消息和有序结果替换消息数组，再重新附加工具定义。

审批状态、工具结果保存在业务会话中；日志仅用于排障，不作为是否已经批准、是否已经执行的判断依据。

## 5. 工具注册与风险检查

工具继承 `ABSTool[RequestT, ResultT]`，声明 `tool_name`、`request_model` 等，并实现异步 `execute()`。网关通过 `TOOL_REGISTRY[call.name]` 选取工具类，在配置的 workspace 下实例化，再使用该工具的请求模型校验 arguments。

```text
工具名称未注册 --> 生成失败工具结果，不执行
       |
已注册 + 参数合法
       |
       +-- 不在 DANGEROUS_TOOLS --> 直接执行
       |
       +-- 在 DANGEROUS_TOOLS
                  |
                  +-- is_dangerous=False --> 直接执行
                  |
                  +-- is_dangerous=True  --> 等待人工审批
```

`approval_details()` 返回展示给用户的操作内容和风险说明。命令工具结合模型声明的 dangerous 参数与本地保守规则判断风险；模型不能自行声明已经获得用户授权。

当前处理代码没有使用 `tools_enabled` 跳过高危审批：高危操作进入人工确认。工作目录只是命令的 cwd，并不构成文件系统或 Shell 沙箱。

## 6. 事件与审批接口

### 工具调用事件

原始 cloud 事件中的字段：

| 字段 | 含义 |
| --- | --- |
| `session_id` | 业务对话标识 |
| `messages` | 包含模型生成的 assistant 工具调用消息 |
| `tool_calls` | LLM 返回的完整工具调用数组，决定结果拼接顺序 |
| `remote_tool_calls` | 交给本地网关执行的调用 |
| `tool_call_messages` | cloud 已执行工具的结果，后续与本地执行结果合并 |

### 人工审批事件

以下示例使用占位标识，具体 operation 和目录由当前工具生成：

```text
event: tool_approval_required
data: {"client_id":"gateway-id","session_id":"session-id","approval_id":"approval-id","tool_call_id":"call-id","workspace":"F:/workspace/project","command":"待执行操作内容","dangerous":true,"risk_reason":"修改现有项目文件"}

```

客户端应展示实际操作、工作目录和风险原因，用户明确选择后才提交决定。客户端不要自行执行已经交给网关处理的同批工具。

```http
POST /local/v1/tools/{client_id}/approvals/{approval_id}
Authorization: Bearer <与 SSE 订阅相同的令牌>
Content-Type: application/json

{"approved": true}
```

拒绝时使用 `{"approved": false}`。当前实现使用上下文中的 app client_id 查找会话；本地路由占位参数保留兼容，界面应使用审批事件返回的 client_id。

缺少认证头返回 401；会话不存在、审批不存在、过期或已处理返回 404。批准后不需要客户端再次触发工具，也不需要再次提交该工具的结果。

### 工具结果事件

```text
event: tool_called
data: {"session_id":"session-id","tool_call_messages":[{"role":"tool","status":"tool_called","tool_call_id":"call-id","content":"工具结果 JSON 字符串"}],"last_message_event":"tool_called"}

```

失败结果的 content 包含 success=false、error_type 和 error。`tool_called` 表示本次调用已产生结果，执行是否成功仍需查看结果内容；命令工具通过 exit_code、stdout、stderr 和 timed_out 表达执行情况。

## 7. Future 唤醒原理

1. `tool_handler` 在当前事件循环创建 Future，按 approval_id 保存到原订阅的 ToolSession.approvals。
2. 发送审批事件后，协程异步等待 Future，不阻塞其他 HTTP 请求。
3. 审批接口验证当前请求可关联的会话，调用 `decision.set_result(body.approved)`。
4. 等待协程恢复：true 继续执行，false 抛出拒绝异常并转换为失败结果。
5. finally 移除审批记录，后续重复提交无法再次唤醒或重复执行工具。

当前等待上限为 300 秒，每等待 15 秒仍未收到决定就向客户端发送一次 heartbeat。审批期间暂停消费上游事件，本地心跳用于维持下游连接，不能证明 cloud 连接仍然有效。

## 8. 多工具顺序与结果续传

网关按 remote_tool_calls 顺序逐个处理，当前调用等待审批时后续调用也等待。每个结果绑定 tool_call_id，并按 `(session_id, call_id)` 缓存到当前连接的 ToolSession.results。

```text
LLM tool_calls：     [远程 A, 云端本地 B, 远程 C]
cloud 已有结果：             [B]
网关执行结果：         [A]              [C]
最终拼接结果：        [A, B, C]
提交消息：            [assistant 工具请求, A 结果, B 结果, C 结果]
```

`tool_handler` 先合并已有结果和本地执行结果，再严格按 tool_calls 排序，保证每条工具请求与响应对应。客户端收到有序的结果事件后，网关通过 `client.events.submit()` 发送同批消息到 cloud。

提交时沿用当前请求的认证和公共请求头。SDK 负责在发送边界展开 SecretStr 密钥、序列化请求以及校验 HTTP 和业务响应。网关不自动重试执行命令或提交工具结果。

## 9. 超时、断连与当前限制

| 情况 | 当前处理 |
| --- | --- |
| 用户拒绝、审批超时 | 产生工具失败结果，继续汇总并回传 cloud |
| 未注册工具、参数无效、工具抛出异常 | 记录异常堆栈，生成失败结果 |
| 命令返回非零 exit_code | 作为命令结果回传，由后续模型决定如何处理 |
| 客户端断连或请求取消 | 关闭上游、释放工具会话、取消待审批 Future |
| 执行过程中取消 | 命令工具尝试终止其直接启动的进程；不保证撤销已发生的文件修改或终止所有子进程 |
| 工具结果提交失败 | 不自动重试，异常向 SSE 处理层传播并关闭流 |
| 重复收到已完成的调用 | 连接内复用结果；不提供跨重启的可靠去重 |

当前状态存放内存中，需要在同一网关进程处理订阅、提交和审批。同一认证信息与网关 client_id 仅允许一个订阅；多个界面同时订阅会产生冲突，尚未实现共享订阅分发。

人工审批控制“是否开始执行”，不能回滚已执行的副作用。上述内存行为是当前实现限制；第 11 节规定的持久化及重启恢复是必须实现的目标，尚未落地代码。

## 10. 代码对应与待核对项

| 文件 | 职责 |
| --- | --- |
| [app.py](../local/src/loong_local/app.py) | 创建网关 client_id、SDK 客户端和工具会话管理器 |
| [session.py](../local/src/loong_local/middleware/session.py) | 构建并保存请求级 SSEContext |
| [sse_context.py](../local/src/loong_local/core/context.py) | 集中传递执行依赖并释放绑定会话 |
| [proxy_sse.py（API）](../local/src/loong_local/api/proxy_sse_api.py) | 建立订阅、登记消息提交参数 |
| [proxy_sse.py（核心）](../local/src/loong_local/api/proxy_sse_api.py) | 流式响应、异常记录和清理 |
| [tool_handler.py](../local/src/loong_local/services/gateway.py) | 解析事件、动态调度、审批等待、结果排序及提交 |
| [tool_approval.py](../local/src/loong_local/api/approval_api.py) | 接收决定并唤醒 Future |
| [tool_session.py](../local/src/loong_local/storage/approval_store.py) | 管理待审批、续传元数据和执行结果 |
| [tools](../local/src/loong_local/tools) | 工具注册、抽象接口与命令工具 |

原实现中的管理器命名不一致已在 local 重建时移除。当前审批及结果使用 OwnerState 类型模型保存到 SQLite，在线身份和模型密钥通过有类型的运行时对象维护。上表链接指向重建后的实现；早期文件名与 Future 说明保留作为历史设计对照。

## 11. 审批持久化与重启恢复设计

### 11.1 必须满足的行为

审批事件及执行所需的数据必须落盘保存。客户端重启、本地网关重启或 SSE 断连，均不得删除待审批记录，也不得将断连视为拒绝。恢复后用户仍可查看原操作并批准或拒绝。

本节定义后续实现目标，替代前文内存方案中“断连即失效”和“300 秒后审批失败”的目标行为。Future、SSEContext 和 SSE 连接只是运行时协调对象，数据库中的记录才是审批及执行状态的依据。现有 300 秒计时如保留，只能结束本次协程等待，不能使持久化审批过期；审批默认一直待处理，显式配置业务有效期时才按 expires_at 处理。

持久化先采用本地文件 SQLite，通过事务维护状态，不能使用内存数据库、缓存 TTL 或日志代替审批记录。记录保存于稳定的网关数据目录，进程重启后使用同一路径；删除本地数据目录不在恢复保障范围内。

### 11.2 持久化数据

审批、工具执行和 cloud 续传分别维护状态，避免“用户批准”被误认为“工具执行成功”。表名为设计建议，后续可按存储模块规范调整。

| 记录 | 需要保存的核心内容 |
| --- | --- |
| 审批记录 | approval_id、稳定 gateway_id、tenant_id、user_id、session_id、call_id、批次标识、工具名称、原始参数、参数摘要、工作区、风险原因、状态、版本号、创建及决定时间、决定者、可选 expires_at |
| 工具批次 | LLM assistant 工具调用消息、完整 tool_calls 顺序、已有 cloud 工具结果、所需模型配置、对话及关联标识 |
| 执行记录 | 唯一执行标识、关联 approval_id / call_id、执行状态、开始和结束时间、结果消息、错误信息 |
| 待提交记录 | 稳定 submission_id、完整有序提交消息、提交状态、重试信息、cloud 确认信息 |
| 事件记录 | 单调递增 event_id、业务标识、事件类型、事件内容、创建时间，用于断连后的通知恢复 |

唯一约束至少覆盖 `(gateway_id, tenant_id, user_id, session_id, call_id)`，同一调用重复到达时返回既有审批和结果，不重复创建执行任务。消息与参数可能含敏感文件内容，需要明确访问、脱敏、保留和清理策略。

Authorization 原文和用户密码不得写入审批表；用户身份使用经过认证确认的身份，不能直接信任 X-User-ID 等请求头。模型 API key 不明文复制到审批或事件表：只保存凭证引用，由本地安全凭证存储提供；无法安全保存时，恢复后要求用户重新提供密钥，审批记录仍然保留。

### 11.3 稳定身份与 client_id

`app.state.client_id = uuid_str()` 继续表示一次运行的连接标识，重启后变化。另增加首次运行生成并持久保存的 gateway_id，表示本地网关安装实例，不能使用临时 client_id 或 Authorization 字符串作为审批的永久归属依据。

审批按稳定 gateway_id 和已认证 tenant_id/user_id 归属。重新登录取得新 token 后，只要身份一致，就可以查询和处理自己的历史审批。用户无权查询其他用户记录。审批事件可携带当前 client_id 方便界面路由，但审批 API 的查找依据应是稳定 approval_id 和已认证身份。

恢复执行之前，需要重新校验工具是否仍然注册、工作区是否存在、当前权限是否允许。工具定义或安全策略发生不兼容变化、实际执行参数与已批准参数摘要不一致时，应中止旧授权并生成新的审批，不能沿用原决定执行修改后的操作。

### 11.4 状态流转

```text
审批状态
                  +--> APPROVED
PENDING ----------+--> REJECTED
                  +--> CANCELLED（明确取消）

客户端退出 / SSE 断连 / 网关重启：PENDING 保持 PENDING

执行状态
WAITING_APPROVAL --批准--> READY --原子领取--> RUNNING --结果落盘--> SUCCEEDED / FAILED
       |                                      |
       +--拒绝/取消-----> SKIPPED             +--进程崩溃--> UNKNOWN

续传状态
PENDING --cloud 确认成功--> DELIVERED
   |
   +--确认丢失--> 保持待核对，按 submission_id 查询或幂等重交
```

使用条件更新或版本号保证只有 PENDING 可以接受首次审批决定。同一决定重复提交可返回已处理状态；与原决定冲突的提交返回冲突，不覆盖历史决定。批准落盘与创建 READY 执行记录必须处于同一事务。

普通 Shell 无法保证任意崩溃位置的严格一次执行。RUNNING 状态在重启后必须标记 UNKNOWN，不能自动重放编辑、删除或其他有副作用的命令；需要查询可验证的外部结果，或由用户明确决定后续处置。仅 READY 且尚未被领取的任务可在恢复校验通过后正常领取执行。

### 11.5 持久化审批流程图

```text
cloud 工具调用到达
        |
        v
转发原始事件供界面展示
        |
        v
识别高危操作，事务保存工具批次 + PENDING 审批 + 审批事件
        |
        v
事务提交后推送 tool_approval_required
        |
        +--客户端不在线--> 保留记录，重连后查询/重放
        |
        v
用户提交 approval_id + 决定（当前有效身份认证）
        |
        v
读取数据库，校验归属、状态及不可变的执行参数
        |
        +--拒绝--> 事务保存 REJECTED + 失败结果 + 结果事件
        |
        +--批准--> 事务保存 APPROVED + READY 执行记录
                                      |
                                      v
                         执行调度器原子领取任务
                                      |
                                      v
                           执行并持久保存结果
                                      |
                                      v
                   批次全部结束，按 tool_calls 顺序汇总
                                      |
                                      v
                     保存 tool_called 事件 + 待提交记录
                                      |
                                      v
                      推送客户端 + 幂等提交 cloud 续传
```

初次原始事件推送不代表审批已经可靠创建。审批落盘失败时不能推送可处理的审批通知，也不能执行工具。客户端是否收到事件不决定数据库中的审批是否存在。

### 11.6 客户端与网关恢复流程

```text
客户端重启                          本地网关重启
    |                                   |
    v                                   v
重新认证并连接 SSE                 打开原 SQLite 数据目录
    |                                   |
    v                                   v
查询待审批与最近处理记录           恢复稳定 gateway_id
    |                                   |
    v                                   v
展示原 approval_id 及操作           扫描 PENDING / READY / RUNNING / 待提交
    |                                   |
    v                                   +--PENDING：保留，等用户决定
继续提交批准或拒绝                      +--READY：校验后调度
                                        +--RUNNING：标记 UNKNOWN，禁止盲重试
                                        +--已完成结果：保留，不重复执行
                                        +--待提交：等待凭证和 cloud 连接恢复
                                                    |
                                                    v
                                        重新认证、订阅并关联原 session_id
                                                    |
                                                    v
                                        客户端查询/事件重放，继续审批
```

连接释放只清理 Future、网络资源和运行时引用，不删除持久化审批、执行结果或待提交记录。工具任务的生命周期与单个界面连接分离；SSE 关闭不应直接取消已获授权的独立执行任务。

### 11.7 接口与 SSE 恢复能力

后续需增加以下能力，具体路由由接口设计确定：

- 查询当前用户的待审批列表及单条审批详情，支持按 session_id 和状态筛选、分页。
- 按 approval_id 提交批准或拒绝，不要求原 Future、原 token 或原 SSE 连接仍然存在。
- 查询执行结果及续传状态，区分“已审批”“执行中”“执行结果未知”和“已提交 cloud”。
- SSE 返回持久化 event_id，通过 Last-Event-ID 补发当前用户可见的事件；重放仅通知状态，不能再次触发执行。

客户端首次或重连时以数据库查询结果校正页面状态，避免仅依赖 SSE 历史通知。事件可能重复投递，界面按 event_id 去重、按 approval_id 更新审批卡片；不能因重放创建新的审批。

cloud 续传需要稳定 submission_id 和服务端幂等确认。仅持久化本地审批无法保证 cloud 的上下文自动恢复：需能重新关联原 session_id、取得未完成工具批次并接受已保存的有序结果。cloud 暂不具备幂等能力时，提交超时不能直接重试，应先核对是否已接收，避免重复推理或重复追加消息。

### 11.8 与当前代码的差异及验收

local 重建后已采用 SQLite 保存审批、工具批次、执行结果、提交记录与事件，并使用独立后台任务调度。当前没有依赖 Future 的审批等待，决定写入数据库后由调度器处理。cloud 结果确认仍需人工核对，执行 UNKNOWN 暂无自动解除接口；实际验证范围见 local/BUILD.md。

后续实现至少验证：客户端关闭后仍能查询原审批；网关重启后重新登录可处理原 approval_id；重复批准只调度一次；拒绝不执行；执行后重启不重放命令；执行中崩溃呈现 UNKNOWN；cloud 断开时保留结果，恢复后按原工具顺序续传；不同用户之间无法读取或批准彼此的记录。

### 11.9 提交新消息时自动拒绝未处理审批

用户向某个 session_id 提交新的对话消息时，网关必须先查询该已认证用户在当前会话中的未处理审批。存在 PENDING 审批时，默认将其改为 REJECTED，不再等待用户逐条确认，并为每个对应的工具调用生成失败结果消息。其他 session_id 的待审批保持不变，避免一个会话的新消息影响另一个会话。

此规则适用于用户提交新对话内容；网关自动回传工具结果、SSE 重连、心跳和查询不触发自动拒绝。检查必须读取持久化记录，因此客户端或网关重启后的历史待审批也包含在内。

```text
用户提交当前会话的新消息
            |
            v
校验认证身份及 session_id 归属
            |
            v
查询当前用户、当前会话的 PENDING 审批
            |
            +--不存在----------------------------+
            |                                    |
            v                                    |
事务更新为 REJECTED，记录原因为用户提交新消息       |
            |                                    |
            v                                    |
为每条被拒绝调用创建 tool 结果及事件                |
            |                                    |
            v                                    |
按原 tool_calls 顺序补齐该批次工具结果              |
            |                                    |
            v                                    |
保存完整上下文及本次待提交消息                     |
            |                                    |
            +------------------------------------+
            |
            v
向 cloud 提交补齐后的上下文和用户新消息
            |
            v
通过 SSE 通知审批拒绝、工具结果及后续模型输出
```

自动拒绝只允许 PENDING 到 REJECTED 的条件更新；审批决定、拒绝结果、状态事件及续传记录在同一事务内保存。记录决定来源为 new_message，保留触发的新消息标识及处理时间，便于追溯。

补齐消息使用标准 Message 类型，role 为 tool、status 为 tool_called，tool_call_id 必须匹配原调用。content 示例：

```json
{
  "success": false,
  "error_type": "ToolApprovalRejected",
  "error": "用户提交了新消息，未处理的工具审批已自动拒绝",
  "reason": "new_message"
}
```

该消息表示工具未执行，不能伪造为执行成功。已有工具结果必须复用，不能重复追加；只为缺少结果且本次确实被拒绝的调用补齐消息。一个批次的 assistant 工具请求之后，必须先按 tool_calls 数组顺序放入全部工具结果，再追加用户新消息：

```text
原消息：       [assistant: tool_calls(A, B, C)]
已完成结果：   [B 的结果]
未处理审批：   [A, C]
补齐后：       [assistant: tool_calls(A, B, C), A 拒绝结果, B 原结果, C 拒绝结果, user 新消息]
```

已批准、READY、RUNNING 或 UNKNOWN 的调用不能通过本规则直接改为拒绝或伪造结果。若同批次仍有这些未完成调用，应保存用户新消息并等待结果，或进入显式处置流程，不能将不完整的工具消息序列发给 LLM。

人工批准和新消息提交发生竞争时，以数据库条件更新成功的决定为准。若自动拒绝先成功，后续批准返回已拒绝状态或冲突，不执行工具；若批准先成功，则按已批准调用处理。事务提交后唤醒在线 Future 为拒绝；没有 Future 不影响处理结果。执行调度器同样必须检查数据库中的最终审批状态。

补齐工具结果和用户新消息应作为同一次有序续传提交，不能先单独提交拒绝结果触发一轮推理，再重复提交用户新消息。cloud 提交使用稳定幂等标识；网络失败保留待提交记录，重复提交用户请求也不得重复生成拒绝结果或重复追加用户消息。

验收应覆盖：多个待审批调用同时拒绝、混合已完成结果的顺序补齐、跨会话隔离、重启后处理历史审批、与人工批准并发竞争，以及重复提交时的审批与消息去重。
