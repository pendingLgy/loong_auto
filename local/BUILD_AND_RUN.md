# 本地服务构建与启动

以下命令在仓库根目录的 PowerShell 执行。需要 Python 3.12+ 和 uv。当前仅有启动入口与健康检查，尚不具备云端转发、工具执行和权限审批能力。

## 安装依赖

```powershell
uv sync --package loong-local
```

## 启动

```powershell
$env:LOCAL_PORT = '8765'
uv run --package loong-local loong-local
```

等价模块入口：

```powershell
uv run --package loong-local python -m loong_local
```

启动类为 LocalApplication，默认绑定 127.0.0.1:8765，保持单 worker。Ctrl+C 停止服务。当前不会自动加载 .env 文件。

## 验证

```powershell
Invoke-RestMethod http://127.0.0.1:8765/local/v1/health
```

响应中的 implementation 为 skeleton，capabilities 为空，表示当前是服务骨架。

## 构建

```powershell
uv build --package loong-contracts
uv build --package loong-local
```

默认产物位于根 dist 目录。分发需同时提供 loong-contracts 产物。独立可执行程序的 PyInstaller 配置尚未创建；wheel 构建不等于无需 Python 的独立程序。
