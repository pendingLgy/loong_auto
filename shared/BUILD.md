# 共享模块构建与使用

shared 提供库，没有独立服务启动入口。以下命令在仓库根目录的 PowerShell 中执行，需要 Python 3.12+ 和 uv。

## Python 依赖

| 模块 | 包名 | 用途 |
| --- | --- | --- |
| contracts | loong-contracts | 请求、响应和 SSE 事件契约 |
| cloud_client | loong-cloud-client | 基于 HTTPX 的异步云端 SDK，依赖 contracts |

```powershell
# 单独同步契约或 SDK；SDK 会同时安装公共契约
uv sync --package loong-contracts
uv sync --package loong-cloud-client

# 本地网关已声明 SDK 依赖，同步 local 也会安装 SDK 和契约
uv sync --package loong-local
```

依赖版本由根 `pyproject.toml` 约束，子包声明实际依赖；共享根 `uv.lock`。添加或调整 workspace 依赖后，执行同步以更新环境和锁文件。以上为使用说明，本次文档更新未执行依赖管理命令。

## 契约导出与构建

```powershell
# 将已有导出入口支持的 Schema 输出到标准输出
uv run --package loong-contracts python -m loong_contracts.export

# 构建两个 Python 包
uv build --package loong-contracts
uv build --package loong-cloud-client
```

构建产物默认位于根 `dist` 目录。SDK 依赖契约包，脱离 workspace 分发时也需要提供对应契约包；wheel 不是独立可执行程序。新增模型是否参与 Schema 导出应检查导出入口，不默认全部自动导出。

## 云端 SDK 使用

SDK 不启动 cloud；先按 [云端构建说明](../cloud/BUILD.md) 启动云端服务。消费端声明 `loong-cloud-client` 依赖，通过 `loong_cloud_client` 导入，不导入云端内部代码。

```python
import httpx
from loong_cloud_client import CloudClient

async with httpx.AsyncClient(
    base_url="http://127.0.0.1:8765",
    headers={"Authorization": f"Bearer {token}"},
    timeout=180,
) as http:
    cloud = CloudClient(http)
    user = await cloud.auth.me()
    async with cloud.events.subscribe(client_id) as events:
        async for event in events:
            payload = event.payload()
```

HTTP 客户端由调用方创建、配置和关闭。SDK 只提供 auth/messages/events 接口封装，不配置地址、超时或默认请求头，不自动刷新令牌、重试或重连。普通业务错误抛出 CloudAPIError，网络和 HTTP 错误沿用 HTTPX 异常。SSE 使用异步上下文释放响应连接。local 透明转发仍保留原始状态和帧。

## TypeScript 共享模块

- contracts：公共 TypeScript 类型。
- client：Effect 本地网关客户端，供 TUI、Web、Electron 使用。
- ui：SolidJS DOM 组件，供 Web、Electron 使用，TUI 不导入。

这些目录已有 package.json 与基础源码，尚未配置完整 Bun workspace、统一构建或类型检查脚本，由消费端构建工具处理；不提供不存在的 dev/build 命令。Python 契约、TypeScript 类型与 Schema 的完整自动生成流水线尚未建立。

用户端业务请求经过 local，本 SDK 供 Python 本地网关等可信消费端访问 cloud，不能作为界面绕过本地网关的依据。local 启动方式见 [本地构建说明](../local/BUILD.md)。

## 验证说明

当前 shared 没有独立配置的测试命令或测试目录。真实 SDK 联调需要运行 cloud 并准备测试账号；模型调用还需 API 密钥。语法、导入或测试收集检查不等于真实接口联调通过。
