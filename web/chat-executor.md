# Web 聊天消息执行器架构（`chat/executor.ts`）

本文说明 `web/src/chat/executor.ts` 在单服务器架构下的职责、队列、SSE 生命周期和消息存储。

## 1. 职责范围

执行器把 `LlmChat` 的发送动作转换为云端对话请求，并接收对应 SSE 事件：

- 按 session 维护待发送消息队列；
- 维护全局唯一 SSE 订阅；
- 串行提交消息，避免云端 `channel.busy`；
- 解析 SSE 事件并写入本地消息存储；
- 队列空闲且收到心跳后关闭 SSE；
- 为页面提供 `isChatStreaming` 状态。

执行器不负责：

- 创建云端 session；
- 工具审批与工具执行；
- 停止生成协议；
- 模型/供应商配置；
- UI 渲染。

## 2. 文件与依赖

| 文件 | 作用 |
| --- | --- |
| `web/src/chat/executor.ts` | 队列、SSE、事件分发、消息提交 |
| `web/src/storage/chat_messages.ts` | 按 session 持久化消息与打字机 |
| `web/src/storage/workspace.ts` | 工作区、选中模型与对话状态 |
| `web/src/api.ts` | 唯一服务器 API 客户端 |
| `shared/client/src/api/cloud_events.ts` | `events.subscribe` / `events.submit` |
| `eventsource-parser` | 增量解析 SSE |

## 3. 核心状态

```text
queues: Map<messageId, PendingMessage>
busySessions: Set<sessionId>
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
- 本地消息 `id`。

## 4. 数据流

```text
LlmChat.onSend(content)
  |
  v
enqueueChatMessage(request)
  |-- appendChatMessage(sessionId, userMessage)
  |-- queues[sessionId].push(pending)
  |-- persistQueues()
  |-- ensureConnection()
  |
  v
SSE connected
  |
  v
drain()
  |-- 取出一条 pending
  |-- events.submit(...)
  |
  v
云端 SSE
  |-- running / start：追加助手增量
  |-- stop：覆盖最终内容、清除 busy、继续 drain
  |-- heartbeat：队列为空时启动 10 秒关闭计时
```

## 5. 生命周期

### 5.1 页面打开

`HomeView` 在挂载时调用 `startChatExecutor()`；登录成功后 `LoginView` 也会调用一次。

执行器会：

1. 从 `loong.web.chat-queue` 恢复队列；
2. 只有队列存在待发送数据时才建立 SSE；
3. 队列为空时保持离线，等待新消息入队后连接。

### 5.2 建立 SSE

```text
GET /api/cloud/sse/subscribe
```

同一时间只允许一个 `Connection`；重复调用复用已有连接。

### 5.3 确保会话并提交消息

新建对话首次发送时，`WorkspaceView` 先调用 `SessionApi.create`：

```text
POST /api/sessions
  session_id: UUID
  session_title: 当前消息前 5 个字符
```

创建成功后写入 `sessionReady: true` 再入队；执行器收到该标记后不再创建 session。旧队列没有该标记时仍保留兜底检查。

然后提交：

```text
POST /api/session/{session_id}/message
```

本地网关负责补齐供应商 API Key，并通过 `context.client_id` 绑定当前 SSE 会话。

请求体：

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

### 5.4 SSE 事件

| 事件 | 处理 |
| --- | --- |
| `connected` | 标记连接可用，触发 `drain` |
| `running` / `start` | 追加助手消息增量 |
| `stop` | 覆盖最终内容、清除 session busy、继续 drain |
| `heartbeat` | 无队列且无 busy 时启动 10 秒关闭计时 |
| 其它 | 取消空闲计时；有 `messages` 时处理助手消息 |

### 5.5 空闲关闭

```text
heartbeat
  -> hasWork()?
       true  -> 取消关闭计时
       false -> 10 秒后 abort SSE
```

`hasWork` 检查所有 session 队列与 `busySessions`。新消息入队会取消关闭。

### 5.6 断线重连

SSE 流异常结束或主动关闭后：

- 清除 `connection`；
- 仍有队列时 1 秒后重连；
- 队列为空时不重连。

## 6. 并发与顺序

- 全局串行提交：同一时间只有一条消息在云端执行。
- 不同 session 的队列独立保存，但按单通道顺序提交。
- 同一 session 的 `busySessions` 防止重复提交。

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
- 历史分页消息标记为 `stop`。
- 每条消息带 `history: boolean` 字段；`chat_messages.ts` 的 `createEffect` 检测到 `stop` 状态后，将当前会话助手消息标记 `history: true`。
- 分页加载的消息直接标记 `history: true`。
- 切换或关闭 `HomeTabs` 标签时，离开的会话助手消息标记 `history: true`。

只有 `history: false` 且状态为 `start` / `running` 的助手消息参与打字机动画。

## 8. 本地消息与打字机

key：

```text
loong.web.chat-messages:<sessionId>
```

写入规则：

- 用户发送：立即写入完整用户消息；
- `running` / `start`：追加助手增量；
- `stop`：覆盖为最终完整内容。

`useTypewriterMessages`：

- 初次读取的历史消息直接显示；
- 新增或增长助手消息逐字显示；
- 内容不再增长时停止计时器。

`LlmChat` 通过 `messages={typedMessages()}` 渲染。

## 9. 队列持久化

key：

```text
loong.web.chat-queue
```

- 存储以消息 ID 为 key 的对象：`{ [messageId]: PendingMessage }`；
- 入队、出队、提交前同步；
- 队列为空时删除 key；
- `busy` 仅保存在内存中；
- 同一时间只允许一条消息在云端执行。

## 10. 错误处理

| 场景 | 行为 |
| --- | --- |
| SSE 建立失败 | 提示；有队列时 1 秒后重试 |
| SSE 读取中断 | 提示；有队列时重连 |
| 提交失败 | 提示；清除当前 busy，继续下一条 |
| 未登录 | 不建立订阅 |
| 未选择会话/模型 | `HomeView` 直接提示 |

## 11. 当前限制

- 新建对话使用 UUID 作为 `session_id`；首次发送时由 `WorkspaceView` 创建 session，标题取消息前 5 个字符。
- `busy` 不持久化，刷新后不恢复“正在执行”状态。
- 提交失败后出队项不会自动重放。
- 工具调用、审批、停止生成尚未接入。
- 仅处理 `assistant` 角色；工具/系统消息暂不展示。

## 12. 扩展方向

- 接入 sessions API，在首次发送前创建云端 session；
- 为提交增加幂等重试与失败队列；
- 把 `stop` / 审批事件映射为 UI 状态；
- 持久化 `busy` 与 pending，支持刷新恢复。
