# 本地网关构建与启动

在仓库根目录的 PowerShell 执行。网关使用单 worker、监听 127.0.0.1:8765，与各界面独立运行。启动网关不自动启动 cloud。

## 依赖

```powershell
uv sync --package loong-local
```

本次实现未执行依赖同步，安装时会更新共享锁文件。

## 启动

```powershell
# 复制 local/.env.example 为 local/.env 后编辑配置
uv run --package loong-local python -m loong_local --path local/.env

# 或直接使用 YAML 示例
uv run --package loong-local python -m loong_local --path local/config.example.yaml
```

也可运行 `uv run --package loong-local loong-local --path local/.env`，启动类为 `LocalApplication`。

`--path` 支持 `.env`、`.env.*`、`.yaml` 和 `.yml` 文件；显式路径不存在或格式无效时启动失败。未传入时使用环境变量与默认值，不自动搜索配置文件。

配置优先级：`LOCAL_` 环境变量 > 指定文件 > 默认值。YAML 使用模型字段名，dotenv 使用 `LOCAL_` 前缀；来源列表支持 JSON 数组或逗号分隔。host 仅允许本机回环地址，端口范围 1–65535。

完整配置见 [dotenv 示例](.env.example) 与 [YAML 示例](config.example.yaml)。相对配置文件路径及日志路径均以启动工作目录为基准，云端 URL 使用服务根地址。

## 使用

```powershell
Invoke-RestMethod http://127.0.0.1:8765/local/v1/health
```

Web、TUI 和 Desktop 的服务地址统一设为 `http://127.0.0.1:8765`，保留云端 `/api/...` 路径：

- 登录：`POST /api/auth/login`，登录结果原样返回，后续请求携带 `Authorization: Bearer ...`。
- 订阅：`GET /api/events/chat/{client_id}/sse`，先收到 connected 再提交消息。
- 提交：`POST /api/events/chat/{client_id}/messages`，body 保留业务 session_id。
- 其他云端 `/api/...` 接口同样转发，方法、查询参数、响应状态及 SSE 帧透传。

浏览器使用支持 Authorization 头的 fetch 流读取 SSE；原生 EventSource 不支持设置该请求头。浏览器 Origin 必须明确列入白名单，默认不允许 null 来源；Electron 页面应使用明确的本地 HTTP 来源。

日志记录本地请求标识、方法、上游状态与流结束，不记录请求或响应 body、认证头和查询参数。日志滚动保留，不充当业务状态。

## 构建与边界

```powershell
uv build --package loong-local
```

当前实现 HTTP/SSE 转发，不自动执行工具、不提供审批、持久化连接、事件重放或多界面共享订阅。不同界面应使用不同 client_id；断开该界面的 SSE 会传递到云端对应连接，不影响其他 client_id。云端当前仍需单 worker。网关不自动重试请求，避免重复执行副作用操作。

真实 cloud 联调需先启动 cloud；健康检查不代表云端已可用。

本地 HTTP 连接由 `loong-cloud-client` 包统一管理。SDK 提供 auth/messages/events 类型化接口，透明转发使用 SDK 的原始响应入口。新增 workspace 包后需同步 local 依赖；本次未执行依赖管理命令。

## 接口测试

```powershell
uv run --package loong-local --extra test python -m pytest local/tests -v
```

当前 `tests/test_auth_api.py` 使用 `CloudClient.auth` 经真实 local 网关调用 cloud。执行前需启动两项服务；不使用 mock，不需要模型密钥。覆盖注册、登录、获取用户信息、刷新令牌、退出撤销、错误密码和无效令牌。

测试通过公共 settings fixture 读取 `local/.env.test`，支持 `LOCAL_API_BASE_URL`（默认 `http://127.0.0.1:8765`）和 `LOCAL_API_TIMEOUT`（默认 180 秒）；同名环境变量优先。该文件是测试客户端配置，不用作网关启动配置。测试创建唯一账号并保留账号及登录日志，不删除业务数据；正常认证流程结束时退出会话。

认证测试配置支持 `LOCAL_API_USERNAME`、`LOCAL_API_PASSWORD`、`LOCAL_API_PLATFORM` 和 `LOCAL_API_ACCESS_TOKEN`。账号需先注册，未设置真实凭证时配置账号测试会失败。`client` fixture 先调用 me 校验，缺失令牌或返回 401 时重新登录；其他错误直接抛出。fixture 返回带默认 Authorization 请求头的 HTTPX 客户端，地址指向 local；SDK 仅封装接口，不管理该客户端。新令牌写回 `.env.test`，并在配置项上方注释更新时间。该文件包含本地凭证，已加入 Git 忽略。若通过环境变量覆盖 token，请同步更新或移除过期值，避免反复覆盖文件中的新令牌。

EventsAPI 集成测试：

```powershell
uv run --package loong-local --extra test python -m pytest local/tests/test_events_api.py -v -s
```

复用已认证 client fixture，经 local 转发到 cloud，覆盖 SSE 订阅、心跳、重复连接拒绝、未订阅提交拒绝及真实对话推送。真实对话需在 `.env.test` 配置 `DEEPSEEK_API_KEY`，未配置时跳过该用例；调用会产生模型费用并保留测试会话。其他 EventsAPI 用例无需模型密钥。测试不使用 mock。
