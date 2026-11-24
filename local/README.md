# Loong Local Gateway

`local` 是运行在用户本机的 Python 网关。它负责连接云端、转发 HTTP / SSE 请求、执行本地工具并处理工具审批；Web、Electron 和 TUI 通过 local 访问云端，不直接连接云端业务接口。

## 主要能力

- 云端 API 透明转发与认证头重建；
- SSE 对话订阅与消息提交；
- 本地文件工具与命令工具；
- 危险工具人工审批；
- 会话级工作目录与访问策略；
- 模型供应商与 API Key 配置；
- 本地 SQLite 状态存储；
- 会话级 SSE `enable_summary` 带宽控制。

## 快速开始

在仓库根目录执行：

```powershell
uv sync --package loong-local

copy local/.env.example local/.env
# 修改 local/.env 中的 cloud_url、security_token 等配置

uv run --package loong-local python -m loong_local --path local/.env
```

也可以使用 YAML：

```powershell
uv run --package loong-local python -m loong_local --path local/config.example.yaml
```

默认监听：

```text
http://127.0.0.1:9528
```

启动时必须传入 `--path`，且云端服务需要单独启动。

## 配置

配置文件支持 `.env`、`.env.*`、`.yaml`、`.yml`。

优先级：

```text
进程环境变量 > 文件中的 LOONG_ 前缀变量 > 默认值
```

主要配置：

| 配置 | 说明 | 默认 |
|---|---|---|
| `log_level` | 日志级别 | `INFO` |
| `enable_security_token` | 是否校验 `X-Security-Token` | `false` |
| `security_token` | 本地网关访问令牌；为空时启动生成 | 空 |
| `enable_summary` | SSE 结束后是否请求云端返回全量消息汇总 | `true` |
| `gateway_config.cloud_url` | 云端服务地址 | `http://127.0.0.1:9527` |
| `gateway_config.workspace` | 默认工作目录 | 当前目录 |
| `gateway_config.workspace_mode` | 默认工作区权限 | `read_only` |
| `gateway_config.timeout` | 云端请求超时 | `180` |
| `gateway_config.sse_read_timeout` | SSE 读取超时 | `60` |
| `db_config.sqlite.database` | 本地 SQLite 路径 | 见配置 |

环境变量示例：

```text
LOONG_LOG_LEVEL=INFO
LOONG_ENABLE_SECURITY_TOKEN=true
LOONG_SECURITY_TOKEN=...
LOONG_ENABLE_SUMMARY=true
LOONG_GATEWAY_CONFIG__CLOUD_URL=http://127.0.0.1:9527
```

关闭全量汇总：

```text
LOONG_ENABLE_SUMMARY=false
```

`enable_summary` 只控制云端是否追加最终 summary；适配器聚合事件仍可能出现。

## API

| 路径 | 说明 |
|---|---|
| `GET /api/health/security_token` | 校验本地令牌与连通性 |
| `GET/PUT/DELETE /api/session-configs/{session_id}` | 会话工作目录与权限配置 |
| `GET/PUT/DELETE /api/supplier-configs` | 模型供应商配置 |
| `GET /api/supplier-configs/models` | 供应商模型列表 |
| `GET/PUT/DELETE /api/supplier-configs/options` | 模型启停选项 |
| `POST /api/tools/{session_id}/approved/{tool_id}` | 提交工具审批 |
| `GET /api/cloud/sse/subscribe` | 订阅云端事件流 |
| `POST /api/cloud/session/{session_id}/message` | 提交对话消息 |
| `/api/cloud/{target:path}` | 其他云端接口透明转发 |

实际路径以 `src/loong_local/api` 中的路由前缀为准。

## 工具与审批

- `tools/filesystem`：读写、复制、移动、删除、目录列表与文件搜索；
- `tools/shell`：命令执行；
- `tools/security`：路径、权限、工具白名单与风险判断；
- 危险工具在 `workspace_write` 等模式下需要人工审批；
- 审批通过后才执行，审批前不落盘；
- 命令工具使用当前进程权限，不等同于系统级沙箱；
- 模型或云端不能绕过 local 的风险检查。

API 密钥只保存在内存或本地配置中，不写入审批记录、事件或日志。

## 测试

语法检查：

```powershell
uv run --package loong-local python -m py_compile local/src/loong_local/app.py
```

真实 HTTP 集成测试：

```powershell
uv run --package loong-local python -m pytest local/tests/test_auth_api.py -v
```

工具调用测试需要先启动 local / cloud，并在 `local/.env.test` 配置 API Key：

```powershell
uv run --package loong-local python -m pytest local/tests/test_tool_call_api.py -v
```

测试中的 HTTP 请求受 `LOCAL_API_TIMEOUT`（默认 180 秒）约束；SSE 单事件另有 120 秒超时。真实模型测试可能产生费用并保留会话记录。

## 相关文档

- [AGENTS.md](AGENTS.md)：local 协作规范；
- [BUILD.md](BUILD.md)：构建与运行；
- [path_secutiry.md](path_secutiry.md)：路径安全；
- [云端 SSE 事件流转](../cloud/LLM_SSE_EVENT_FLOW.md)；
- [Web 聊天执行器](../web/chat-executor.md)。
