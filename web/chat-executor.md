# Web 聊天消息执行器（`chat/executor.ts`）

本文说明 `web/src/chat/executor.ts` 在单服务器架构下的职责、队列、SSE 生命周期、事件处理和消息存储。

## 1. 职责范围

执行器把 ChatPage 的发送动作转换为云端对话请求，并接收 SSE 事件：

- 按 session 维护待发送消息队列；
- 维护全局唯一 SSE 订阅；
- 串行提交消息，避免云端 `channel.busy`；
- 解析 SSE 事件并写入本地消息存储；
- 队列空闲并收到心跳后关闭 SSE；
- 为页面提供 `isChatStreaming` 状态。

执行器不负责：

- 工作区选择；
- 模型与供应商选择；
- UI 渲染；
- 工具审批；
- 工具执行编排。

## 2. 文件与依赖

| 文件 | 作用 |
| --- | --- |
| `web/src/chat/executor.ts` | 队列、SSE、事件分发、消息提交 |
| `web/src/views/workspace/ChatPage.tsx` | 新会话创建、消息发送、模型与工作区选择 |
| `web/src/storage/chat_messages.ts` | 按 session 持久化消息与打字机 |
| `web/src/storage/session_config.ts` | 会话工作区、模型、pending 状态 |
| `web/src/api.ts` | 唯一服务器 API 客户端 |
| `shared/client/src/api/cloud_events.ts` | `events.subscribe` / `events.submit` |
| `eventsource-parser` | 增量解析 SSE |

## 3. 核心状态

```text
queues: Map<messageId, PendingMessage>
busySessions: Set<sessionId>
createdSessions: Set<sessionId>
sessionWorkspaceIds: Map<sessionId, workspaceId>
connection: Connection | undefined
queuesLoaded: boolean
revision: Signal<number>
```

### Connection

```ts
interface Connection {
  controller: AbortController;
  connected: boolean;
  closed: boolean;
  idleTimer?: number;
}
```

### PendingMessage

- `sessionId`；
- `workspaceId`、`tenantId`、`userId`；
- `sessionTitle`；
- `provider`、`model`；
- `content`；
- 本地消息 `id`；
- `sessionReady`。

## 4. 发送流程

```text
ChatPage.sendChat(content)
  |
  |-- 参数校验（工作区、登录、模型）
  |-- 如果是 pending 新会话
  |     |-- client.session.create(...)
  |     |-- 保存 pending: false
  |     |-- 派发 session-created 事件
  |
  |-- saveSessionConfig(...)
  |-- enqueueChatMessage(request)
  |-- startChatExecutor()
  |
  v
enqueueChatMessage(request)
  |-- appendChatMessage(sessionId, userMessage)
  |-- queues[messageId] = pending
  |-- persistQueues()
  |-- ensureConnection()
  |
  v
SSE connected
  |
  v
drain()
  |-- 全局只允许一条消息处于提交中
  |-- 取出队列消息
  |-- busySessions.add(sessionId)
  |-- submitPending(message)
  |
  v
submitPending
  |-- ensureSession(message) 兜底
  |-- events.submit(...)
  |
  v
云端 SSE
```

### 4.1 新会话创建职责

- `ChatPage` 是主路径：发送前根据 `session_config.pending` 判断；
- `pending: true` 时调用 `client.session.create`；
- 创建成功后才提交消息；
- `executor.ensureSession` 保留兜底：
  - `sessionReady: true` 时跳过；
  - 未标记时尝试创建，失败后调用 `session.get` 确认已存在。

### 4.2 提交请求体

```ts
{
  tenantId,
  userId,
  workspaceId,
  sessionId,
  sessionTitle,
  llm: { provider, model },
  tools: [],
  messages: [userMessage],
}
```

## 5. SSE 生命周期

### 5.1 建立连接

```text
GET /api/cloud/sse/subscribe
```

同一时间只允许一个 `Connection`；重复调用复用已有连接。

### 5.2 页面打开

`WorkspaceView` 挂载时调用 `startChatExecutor()`：

1. 从 `loong.web.chat-queue` 恢复队列；
2. 只有队列存在待发送数据时才建立 SSE；
3. 队列为空时保持离线，等待新消息入队后连接。

### 5.3 空闲关闭

```text
heartbeat
  -> hasWork()?
       true  -> 取消关闭计时
       false -> 10 秒后 abort SSE
```

`hasWork` 检查所有 session 队列与 `busySessions`。

### 5.4 断线重连

SSE 流异常结束或主动关闭后：

- 清除 `connection`；
- 仍有队列时 1 秒后重连；
- 队列为空时不重连。

## 6. SSE 事件处理流程

## 6.1 正常文本回复

```text
connected
  -> running*      （助手增量）
  -> stop          （响应结束）
```

### 6.2 工具调用

```text
connected
  -> running*
  -> tool_calling
  -> stop
```

`tool_calling` 帧可能包含：

- `messages`：当前 assistant 工具调用消息；
- `tool_call_messages`：本地工具结果；
- `tool_calls`：全部工具调用；
- `remote_tool_calls`：需要客户端执行的远程工具。

### 6.3 异常

```text
running(error)
  -> stop(error=true)
```

异常路径不会发送 `all_messages`。

## 6.4 执行器事件表

| 事件 | 当前处理 |
| --- | --- |
| `connected` | 标记连接可用，触发 `drain()` |
| `heartbeat` | 无队列且无 busy 时启动 10 秒关闭计时 |
| `running` / `start` | 追加 assistant 消息增量 |
| `tool_calling` | 保存工具列表并结束本轮生成，清除 busy，不执行工具 |
| `tool_called` | 仅可能出现在工具结果消息内部；不作为顶层事件处理 |
| `stop` | 覆盖最终内容、标记历史、清除 busy、继续 `drain()` |
| `all_messages` | 忽略；不读取全量消息，避免重复传输与带宽浪费 |
| 其他 | 取消空闲计时；有 `messages` 时处理 assistant 消息 |
| `error=true` | 依赖后续 `stop` 清理 busy；错误内容按普通消息展示 |

### 6.5 事件字段

```text
LoopEvent
  ├─ client_id
  ├─ session_id
  ├─ error
  ├─ summary（Web 不读取）
  ├─ last_message_event
  ├─ messages
  ├─ tool_call_messages
  ├─ tool_calls
  └─ remote_tool_calls
```

## 6.6 读取事件流的消息处理流程

```text
SSE Response.body
  │
  ▼
reader.read()
  │
  ▼
TextDecoder.decode(value, { stream: true })
  │
  ▼
eventsource-parser.feed()
  │
  ▼
onEvent(EventSourceMessage)
  │
  ├─ JSON.parse(event.data)
  │    └─ 失败：丢弃该帧
  │
  ├─ type = event.event
  │           ?? payload.last_message_event
  │           ?? "message"
  │
  ▼
handleEvent()
  │
  ├─ connection 不存在
  │    └─ 丢弃
  │
  ├─ heartbeat
  │    └─ scheduleIdleClose(connection)
  │         ├─ hasWork() == true：取消关闭计时
  │         └─ hasWork() == false：10 秒后 abort
  │
  ├─ connected
  │    ├─ connection.connected = true
  │    └─ drain()
  │
  ├─ 其他事件
  │    └─ cancelIdleTimer(connection)
  │
  ▼
applyLoopEvent(payload)
  │
  ├─ session_id 无效或 messages 非数组
  │    └─ 忽略
  │
  └─ 遍历 messages
       │
       ├─ 仅处理 role == "assistant"
       ├─ content 必须为非空字符串
       ├─ message.id 缺失时生成 assistant-{sessionId}-{index}
       ├─ 读取 message.status
       └─ 读取 sessionWorkspaceIds
            │
            ├─ status == running / start
            │    └─ appendAssistantMessageDelta()
            │         └─ 追加本地助手内容并持久化
            │
            └─ 其他 status
                 └─ upsertAssistantMessage()
                      └─ 覆盖本地助手内容并持久化
  │
  ▼
type == stop
  ├─ busySessions.delete(session_id)
  ├─ touch()
  └─ drain()
       └─ 继续提交下一条队列消息
```

### 事件流结束

```text
reader.read() 返回 done 或异常
  │
  ▼
finally
  ├─ connection.closed = true
  ├─ connection.connected = false
  ├─ cancelIdleTimer()
  ├─ connection = undefined
  ├─ reader.cancel()
  └─ hasWork() == true
       └─ 1 秒后 ensureConnection()
```

### 消息写入分支

| SSE 类型 | 本地处理 |
| --- | --- |
| `connected` | 标记连接，触发队列提交 |
| `heartbeat` | 根据队列状态关闭或保持连接 |
| `running` / `start` | 追加 assistant 增量 |
| `tool_calling` | 保存工具列表，结束生成状态，保留工具视图 |
| `tool_called` | 不单独处理顶层事件 |
| `stop` | 覆盖最终内容，标记历史，清除 busy，继续下一队列 |
| `all_messages` | 忽略；不读取全量消息，避免重复传输与带宽浪费 |
| `error=true` | 内容照常写入，等待 `stop` 清理 busy |

当前 Web 端不依赖 `summary` 或 `all_messages` 的全量消息。模型增量通过 `running` / `start` 写入；`tool_calling` 与 `stop` 都表示本轮输出结束并清理 busy，其中 `tool_calling` 保留工具列表供界面展示。

## 7. 消息状态

执行器与 `src/chat/status.ts` 使用云端状态常量：

```text
start
running
tool_calling
tool_approval_required
tool_called
stop
```

- 用户消息入队状态为 `start`；
- SSE 助手增量使用 `running`；
- 工具调用/审批/结束事件保留对应状态；
- 历史分页消息标记为 `stop`；
- 每条消息带 `history: boolean` 字段。

`chat_messages.ts` 的 `createEffect` 检测到 `stop` 状态后，将当前会话助手消息标记 `history: true`：

- 历史分页消息直接标记 `history: true`；
- 切换或关闭 `HomeTabs` 标签时，离开的会话助手消息标记 `history: true`；
- 只有 `history: false` 且状态为 `start` / `running` 的助手消息参与打字机动画。

## 8. 本地消息与打字机

key：

```text
loong.web.chat-messages:<sessionId>
```

写入规则：

- 用户发送：立即写入完整用户消息；
- `running` / `start`：追加助手增量；
- `stop` / 其他最终状态：覆盖为最终完整内容。

`useTypewriterMessages`：

- 历史消息直接显示；
- 新增或增长助手消息逐字显示；
- 内容不再增长时停止计时器。

`LlmChat` 通过 `messages={typedMessages()}` 渲染。

## 9. 队列持久化

key：

```text
loong.web.chat-queue
```

- 以消息 ID 为 key 保存 `PendingMessage`；
- 入队、出队、提交前同步；
- 队列为空时删除 key；
- `busy` 仅保存在内存；
- 同一时间只允许一条消息在云端执行。

## 10. 错误处理

| 场景 | 行为 |
| --- | --- |
| SSE 建立失败 | 提示；有队列时 1 秒后重试 |
| SSE 读取中断 | 提示；有队列时重连 |
| 提交失败 | 提示；清除当前 busy，继续下一条 |
| 未登录 | 不建立订阅 |
| 未选择工作区/模型 | ChatPage 直接提示，不发送 |

## 11. 当前限制

- 新会话使用 UUID 作为 `session_id`；ChatPage 首次发送创建 session，标题取消息前 10 个字符；
- `busy` 不持久化，刷新后不恢复“正在执行”状态；
- 提交失败后出队项不会自动重放；
- 工具调用、审批、停止生成尚未接入；
- 仅处理 `assistant` 角色，工具/系统消息暂不展示。

## 12. 扩展方向

- 接入远程工具执行与结果回传；
- 接入工具审批事件；
- 为提交增加幂等重试与失败队列；
- 持久化 busy 与 pending，支持刷新恢复。
