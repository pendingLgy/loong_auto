# LLM SSE 事件状态流转

本文描述云端对话 SSE 中 `LoopEvent.last_message_event` 的状态流转，基于当前 `events_api.py`、`agent/loop.py` 和模型适配器实现。

涉及文件：

- `src/loong_cloud/api/events_api.py`
- `src/loong_cloud/agent/loop.py`
- `src/loong_cloud/agent/adapters/openai.py`
- `shared/contracts/src/loong_contracts/request/message.py`

## 1. 连接与提交

```text
Client
  │
  ├─ GET /api/events/chat/{client_id}/sse
  │    ├─ 创建 EventSession(queue, task, busy)
  │    ├─ 首帧发送 LoopEvent(connected)
  │    └─ 空闲每 15s 发送 heartbeat
  │
  └─ POST /api/events/chat/{client_id}/messages/{session_id}
       ├─ 检查 SSE 连接
       ├─ 检查 channel.busy
       ├─ 保存用户消息
       ├─ 记录 save_contexts
       └─ 创建 _run_dialogue 任务
```

提交请求体包含：

```text
enable_summary: bool | None = True
```

该字段决定 AgentLoop 是否追加最终 summary 事件。

## 2. 正常文本回复

```text
connected
   │
   ▼
running  ──▶ running ──▶ ...
   │
   ▼
stop
   │
   ▼
all_messages                    (适配器聚合事件)
   │
   ▼
all_messages (summary=true)     (仅 enable_summary=true)
```

说明：

- 适配器在模型流结束后发送 `STOP`；
- 随后发送一条 `ALL_MESSAGES` 聚合消息；
- `AgentLoop` 将 `STOP` 作为 response 并转发；
- `ALL_MESSAGES` 作为普通事件转发；
- 当 `enable_summary=true` 时，流结束后再追加一条 `summary=true` 的最终汇总。

## 3. 工具调用

```text
connected
   │
   ▼
running
   │
   ▼
tool_calling
   │
   ├─ 本地工具：立即执行并附带 tool_call_messages
   └─ 远程工具：remote_tool_calls 返回客户端
   │
   ▼
all_messages
   │
   ▼
all_messages (summary=true)     (仅 enable_summary=true)
```

`tool_calling` 帧：

```text
messages             = assistant 工具调用消息
tool_call_messages   = 本地工具结果（TOOL_CALLED）
tool_calls           = 全部工具调用
remote_tool_calls    = 客户端待执行工具
last_message_event   = "tool_calling"
```

当前同轮只执行本地工具并结束本轮；远程工具结果由客户端下一次提交继续。

## 4. enable_summary 行为

```text
enable_summary = true   (默认)
  -> 模型流事件
  -> 适配器 all_messages 聚合事件
  -> summary=true 的完整 messages

enable_summary = false
  -> 模型流事件
  -> 适配器 all_messages 聚合事件
  -> 直接结束，不再追加 summary
```

注意：

- `enable_summary` 只控制 AgentLoop 的最终 summary；
- 适配器自身的 `ALL_MESSAGES` 聚合消息仍会发出；
- 客户端不应依赖 `summary` 一定存在。

## 5. 异常流程

```text
running / tool_calling 过程中异常
   │
   ├─ event: running
   │    data: {error:false, messages:[错误 assistant 消息]}
   │
   ├─ 保存错误 assistant 消息
   │
   └─ event: stop
        data: {error:true, messages:null}
```

异常路径以 `stop(error=true)` 结束。

## 6. 心跳与断开

```text
GET /api/events/chat/{client_id}/sse
   │
   ├─ event: connected
   │
   ├─ 15 秒无消息
   │    └─ event: heartbeat
   │
   └─ 客户端断开
        ├─ 取消 stream task
        ├─ 取消对话任务
        ├─ 清空队列
        └─ 移除 EventSession
```

## 7. 状态机总图

```text
                    ┌──────────────┐
                    │  connected   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
              ┌────▶│   running    │◀────┐
              │     └──────┬───────┘     │
              │            │             │
              │            ├─────────────┘
              │            │
              │            ├──────────────┐
              │            │              │
              │            ▼              ▼
              │     ┌──────────────┐ ┌──────────────┐
              │     │ tool_calling │ │     stop     │
              │     └──────┬───────┘ └──────┬───────┘
              │            │                │
              │            └───────┬────────┘
              │                    ▼
              │             ┌──────────────┐
              │             │ all_messages │
              │             └──────┬───────┘
              │                    │
              │                    ▼
              │             ┌──────────────────┐
              │             │ all_messages     │
              │             │ summary=true     │
              │             └──────────────────┘
              │
              └────▶ 异常：running -> stop(error=true)
```

空闲时：

```text
任意等待状态 -> heartbeat
```

## 8. 事件字段

```text
LoopEvent
  ├─ client_id
  ├─ session_id
  ├─ error
  ├─ summary
  ├─ last_message_event
  ├─ messages
  ├─ tool_call_messages
  ├─ tool_calls
  └─ remote_tool_calls
```

## 9. 最终消息保存

`HeartbeatStreamingResponse` 在发送 `all_messages` 时检测：

```text
event: all_messages
error=false
```

随后启动后台保存任务：

```text
save_stop_message(event)
  -> session_store.get_by_session_id(...)
  -> message_store.add_message(final assistant)
```

- 保存任务不随 SSE 断连取消；
- 连接关闭前等待已提交保存任务完成；
- `save_contexts` 使用后移除，重复 `all_messages` 不会重复保存。

## 10. 状态说明

| 状态 | 来源 | 说明 |
|---|---|---|
| `connected` | chat_sse | SSE 建连成功 |
| `heartbeat` | events() | 空闲 15 秒心跳 |
| `running` | 模型适配器 | 助手增量内容 |
| `start` | 枚举已定义 | 当前适配器未实际发送 |
| `tool_calling` | 模型适配器 | 工具调用 |
| `tool_called` | tool_call_messages | 工具结果消息状态，非顶层事件 |
| `stop` | 模型适配器 | 模型流结束，AgentLoop 作为 response |
| `all_messages` | 适配器 / AgentLoop | 模型聚合或最终 summary |
| `tool_approval_required` | 枚举已定义 | 当前链路未发送 |

## 11. 前端处理建议

```text
connected      -> 保持连接
heartbeat      -> 忽略
running        -> 更新助手增量
tool_calling   -> 展示工具调用；按 remote_tool_calls 执行
stop           -> 当前 assistant 回复结束
all_messages   -> 可选；不要假设一定包含 summary
summary=true   -> 完整历史汇总，仅在 enable_summary=true 时出现
error=true     -> 显示错误并停止加载
```

## 12. 当前限制

- `summary` 不是稳定必须字段；
- `all_messages` 可能来自适配器，也可能来自 AgentLoop summary；
- `enable_summary=false` 时仍会收到适配器聚合的 `all_messages`；
- 当前工具调用不会在同一轮继续调用模型；
- 仅支持单 worker，不支持跨进程 SSE 分发。
