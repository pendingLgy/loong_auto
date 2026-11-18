结合你前面刚刚实现的 **ABSTool 抽象类**、**ToolExecutor（支持重试与超时）**、**ToolRegistry（手动注册）** 以及 **基于 `tool_id` 的持久化挂起/恢复表结构（`PendingToolTaskService`）**，我为你将原有的架构文档和时序逻辑梳理并更新为了这份**现代化的企业级工具调用与人工审批（HITL）全链路流程规范**。

---

# SSE 工具调用与人工审批执行流程（更新版）

## 一、 核心架构组件与流转关系

当前实现的工具调用链路完全遵循“**职责分离**”原则：本地网关（Python / FastAPI / SQLAlchemy Core）只负责风险拦截、持久化挂起和实际执行，不直接依赖 HTTP 前端或 TUI 界面。

```text
TUI / Web / Electron (前端/客户端)
       |
       | 1. HTTP 提交审批 (approve=true/false, tool_id)
       v
Python 本地网关 (Tool Gateway / SSE Loop)
       |-- ToolRegistry       --> 集中式显式管理所有已注册的工具类
       |-- ToolExecutor       --> 托管重试机制、全局超时与异常捕获
       |-- ABSTool            --> 统一的执行契约、自动生成 Schema 与安全守则
       |-- ToolTaskManager    --> 基于 tool_id 的挂起任务持久化（pending_tool_tasks）
       |
       v
cloud Agent Loop --> LLM 驱动

```

---

## 二、 完整工具调用与审批恢复时序流程

整个流程分为 **“主执行链（触发挂起）”** 与 **“人工恢复链（Resume）”** 两大核心阶段。

### 阶段 1：模型发起调用与本地网关的安全拦截/挂起

```text
客户端建立 SSE 订阅，并向 cloud 提交对话请求
       |
       v
网关接收到 cloud 返回的完整 SSE 帧（包含 remote_tool_calls）
       |
       v
遍历每个 tool_call，通过 tool_id 和 tool_name 从 ToolRegistry 中获取工具类与参数
       |
       v
通过 ToolExecutor 托管运行工具实例：
       |
       +--> 1. 检查 is_dangerous(request)
       |       |
       |       +---> [非危险 / 或已授权 (approved=True)]
       |       |       |
       |       |       v
       |       |     执行 ToolExecutor.run() 
       |       |     （内置重试次数、backoff 退避、单次及全局超时控制）
       |       |       |
       |       |       v
       |       |     返回执行结果 (CommandResult)，提交给 cloud 继续 Loop。
       |       |
       |       +---> [高危操作 且 未授权 (approved=False)]
               |
               v
             【触发挂起】工具抛出 ToolSuspendedError (携带 tool_id)
               |
               v
             网关捕获异常，调用 PendingToolTaskService
             将请求参数序列化并存入 pending_tool_tasks 表 (状态为 pending)
               |
               v
             SSE 向客户端推送 tool_suspended 事件 (携带 tool_id, summary, risk_reason)
               |
               v
             客户端弹出人工审批框，等待用户操作。

```

---

### 阶段 2：人工审批、持久化恢复与重试执行

当用户在客户端（TUI / Web / Electron）点击“同意”或“拒绝”后，执行独立的恢复分支：

```text
用户在客户端点击审批
       |
       | 2. HTTP 提交：POST /api/agent/resume-tool (tool_id, approved: true/false)
       v
网关后端接收请求：
       |
       +---> [用户选择拒绝 (approved=false)]
       |       |
       |       v
       |     调用 PendingToolTaskService 移除任务记录，返回拒绝响应。
       |
       +---> [用户选择同意 (approved=true)]
               |
               v
             从数据库查询出对应的挂起任务 (pending_tool_tasks)
               |
               v
             通过 ToolRegistry 创建工具实例，反序列化还原出 request_model 对象
               |
               v
             再次调用 ToolExecutor.run(tool, request_obj, approved=True)
             （此时安全守则放行，工具开始真正调用底层系统的 shell / 执行器）
               |
               v
             【重试与超时兜底】：
             - 若因瞬时抖动出错，ToolExecutor 自动按配置重试 (max_retries)
             - 若超过 global_timeout 或内部进程卡死，自动强杀并捕获异常
               |
               v
             执行成功！清理 pending_tool_tasks 中的任务记录
               |
               v
             将最终结果返回给客户端，并同步提交给 cloud Agent Loop 进入下一轮对话。[cite: 1]
```[cite: 1]

---

## 三. 关键状态与数据流转规范

1. **`tool_id` 唯一锚点**：
   * 大模型下发的 `call_id` 是整个挂起与恢复生命周期的唯一主键。无论经历几次数据库持久化或前端交互，`tool_id` 始终不变，确保多轮会话中的任务映射百分之百精准。
2. **安全与重试的互斥性**：
   * **未授权的高危操作（`ToolUnauthorizedError` / `ToolSuspendedError`）绝不重试**。重试逻辑仅针对系统级瞬时错误（如 I/O 抖动、临时网络超时），业务层的安全拦截和拒绝必须立即阻断。
3. **数据解耦存储**：
   * 所有的工具输入参数通过 Pydantic 模型的 `.model_dump(mode="json")` 转换为 JSON 文本存入 SQLite 的 `request_data` 字段，恢复时再由各自工具的 `request_model` 动态反序列化，保证了框架对未来扩展任意新工具时的极高兼容性。

```