# LLM 工具调用路径安全设计

## 1. 设计目标

在 LLM Agent 执行工具调用时，LLM 返回的参数、路径和 Shell 命令均视为不可信输入。

为了防止 LLM 通过工具调用访问工作空间之外的文件，需要建立统一的路径安全控制机制。

核心目标：

1. 防止路径穿越攻击（Path Traversal）。
2. 防止通过绝对路径访问系统敏感文件。
3. 防止通过符号链接（Symlink）绕过目录限制。
4. 防止通过 Shell 命令间接访问未授权文件。
5. 统一管理文件读取、写入、删除和执行权限。
6. 所有工具统一经过安全校验，避免各工具重复实现安全逻辑。
7. 通过操作系统级沙箱提供最终安全边界。

核心原则：

**LLM 返回的所有路径都是不可信数据，任何工具都不能直接使用未经授权校验的原始路径访问文件系统。**

---

## 2. 安全架构

建议在 Tool Executor 层增加统一的安全控制模块。

```text
                    LLM
                     |
                     |
               Tool Call Request
                     |
                     v
             +------------------+
             |   Tool Executor  |
             +------------------+
                     |
                     v
             +------------------+
             | Tool Permission  |
             |      Guard       |
             +------------------+
                     |
                     v
             +------------------+
             | Path Security    |
             |     Manager      |
             +------------------+
                     |
          +----------+----------+
          |          |          |
          v          v          v
       路径规范化  权限检查   越权检测
          |          |          |
          +----------+----------+
                     |
                     v
             +------------------+
             | Sandbox Executor |
             +------------------+
                     |
                     v
               File System
```

### 2.1 模块职责

| 模块 | 职责 |
|---|---|
| Tool Executor | 接收和分发 LLM 工具调用 |
| Tool Permission Guard | 控制工具调用权限 |
| Path Security Manager | 统一管理文件路径安全 |
| Sandbox Executor | 在隔离环境中执行操作 |
| File System | 实际文件系统 |

### 2.2 安全控制原则

- LLM 不能决定自己的文件访问权限。
- 工具不能绕过 Path Security Manager。
- 路径校验不能代替操作系统权限控制。
- Shell 命令不能仅依赖路径扫描实现安全隔离。
- 所有敏感操作必须经过权限验证。

---

## 3. Workspace 工作空间设计

建议为每个 Agent 或执行任务分配独立的 Workspace。

例如：

```text
/workspace/
│
├── project/
│   ├── main.py
│   └── config.json
│
├── uploads/
│   └── input.txt
│
├── output/
│   └── result.txt
│
└── temp/
```

默认只允许访问 Workspace 内部资源。

### 3.1 路径访问规则

| 路径 | 处理方式 | 原因 |
|---|---|---|
| project/main.py | 允许 | 工作空间内部 |
| ./project/main.py | 允许 | 工作空间内部 |
| project/../uploads/a.txt | 允许 | 规范化后仍在工作空间 |
| ../../etc/passwd | 拒绝 | 路径穿越 |
| /etc/passwd | 拒绝 | 外部绝对路径 |
| /workspace/project/main.py | 按策略处理 | 授权根目录内的绝对路径 |
| project/link/passwd | 视目标路径决定 | 需要检查符号链接 |
| /root/.ssh/id_rsa | 拒绝 | 系统敏感文件 |

### 3.2 Workspace 配置

建议采用统一配置：

```yaml
workspace:
  root: /workspace

  permissions:
    read:
      - project
      - uploads
      - output

    write:
      - project
      - output
      - temp

    delete:
      - output
      - temp

  security:
    allow_absolute_path: false
    allow_path_traversal: false
    allow_symlink: false
    follow_symlink: false
```

注意：配置中的目录权限还需要由执行器实际落实，不能只依赖配置声明。

---

## 4. Path Security Manager

建议独立实现路径安全管理器，所有工具统一调用。

### 4.1 核心职责

```text
PathSecurityManager
│
├── normalize_path()
│   └── 路径规范化
│
├── validate_path()
│   └── 路径合法性检查
│
├── check_workspace()
│   └── 工作空间边界检查
│
├── check_symlink()
│   └── 符号链接检查
│
├── check_permission()
│   └── 读写权限检查
│
├── check_operation()
│   └── 操作类型检查
│
└── resolve_path()
    └── 返回授权路径
```

### 4.2 Python 基础实现

```python
from pathlib import Path, PureWindowsPath


class PathSecurityError(Exception):
    """路径安全异常"""
    pass


class PathGuard:

    def __init__(self, workspace: str):
        self.workspace = Path(workspace).resolve(strict=True)

        if not self.workspace.is_dir():
            raise PathSecurityError("Workspace 必须是目录")

    def validate(self, raw_path: str) -> Path:

        if not isinstance(raw_path, str) or not raw_path:
            raise PathSecurityError("路径不能为空")

        if "\x00" in raw_path:
            raise PathSecurityError("路径包含非法字符")

        # 跨平台绝对路径检查
        win_path = PureWindowsPath(raw_path)

        if win_path.is_absolute() or win_path.drive:
            raise PathSecurityError("不允许使用绝对路径")

        path = Path(raw_path)

        if path.is_absolute():
            raise PathSecurityError("不允许使用绝对路径")

        # 规范化路径并解析符号链接
        target = (self.workspace / path).resolve(strict=False)

        # 判断是否超出 Workspace
        try:
            target.relative_to(self.workspace)
        except ValueError:
            raise PathSecurityError(
                f"路径越权访问: {raw_path}"
            )

        return target


if __name__ == "__main__":

    guard = PathGuard("/workspace")

    try:
        path = guard.validate("project/main.py")
        print("安全路径:", path)

    except PathSecurityError as e:
        print("安全拦截:", e)
```

注意：

这只是基础路径校验实现，不是完整的并发安全文件访问方案。

对于写入、创建、删除等操作，需要进一步防范符号链接竞争和 TOCTOU（检查与使用之间的竞态条件）。

生产环境建议使用基于文件描述符的相对路径操作，例如 Linux `openat`、`openat2`，配合 `RESOLVE_BENEATH`、`RESOLVE_NO_SYMLINKS` 等约束。

---

## 5. 工具权限管理

路径安全和工具权限需要分开管理。

即使路径合法，也不代表当前工具拥有对应的操作权限。

### 5.1 权限类型

```python
from enum import Enum


class PathPermission(Enum):

    READ = "read"

    WRITE = "write"

    DELETE = "delete"

    EXECUTE = "execute"
```

### 5.2 工具权限矩阵

| 工具 | READ | WRITE | DELETE | EXECUTE | 需要审批 |
|---|---|---|---|---|---|
| read_file | 是 | 否 | 否 | 否 | 否 |
| write_file | 是 | 是 | 否 | 否 | 是 |
| delete_file | 否 | 否 | 是 | 否 | 是 |
| list_directory | 是 | 否 | 否 | 否 | 否 |
| search_files | 是 | 否 | 否 | 否 | 否 |
| create_directory | 否 | 是 | 否 | 否 | 是 |
| move_file | 是 | 是 | 是 | 否 | 是 |
| copy_file | 是 | 是 | 否 | 否 | 是 |
| shell_command | 是 | 是 | 是 | 是 | 是（一律） |

"需要审批"指 `workspace_write` 模式下的行为：`full` 模式不再逐次确认，`read_only` 模式则直接拒绝变更与执行类操作。

这里的权限矩阵是工具能力定义，实际权限仍应由执行环境强制实施。

### 5.3 权限校验流程

```text
Tool Call
    |
    v
获取工具名称
    |
    v
获取工具权限配置
    |
    v
提取路径参数
    |
    v
路径规范化
    |
    v
检查 Workspace
    |
    v
检查操作权限
    |
    v
检查是否需要用户授权
    |
    v
执行工具
```

---

## 6. Tool Call 参数安全

不建议让 LLM 通过任意 Shell 字符串执行文件操作。

### 6.1 不推荐的设计

```json
{
  "tool": "shell",
  "arguments": {
    "command": "cat /etc/passwd"
  }
}
```

这种方式存在以下风险：

- 命令注入。
- 命令替换。
- 管道绕过。
- 重定向绕过。
- 环境变量访问。
- 系统文件访问。
- 任意程序执行。

### 6.2 推荐的设计

提供结构化工具：

```json
{
  "tool": "read_file",
  "arguments": {
    "path": "project/main.py"
  }
}
```

工具内部：

```python
def read_file(path: str):

    safe_path = path_guard.validate(path)

    if not safe_path.is_file():
        raise ValueError("目标文件不存在或不是普通文件")

    return safe_path.read_text(encoding="utf-8")
```

这样可以避免从任意 Shell 命令中提取路径所带来的复杂性。

### 6.3 工具设计建议

优先提供：

- read_file
- write_file
- list_directory
- search_files
- delete_file
- create_directory
- move_file
- copy_file

对于这些工具，路径参数统一经过 Path Security Manager。

---

## 7. Shell 工具安全

如果业务必须支持 Shell，需要额外建立执行隔离。

### 7.1 不要只依赖正则表达式

以下命令都可能访问工作空间之外的文件：

```bash
cat /etc/passwd

cat "$HOME/.ssh/id_rsa"

cat $(echo /etc/passwd)

cat /workspace/../../etc/passwd

find / -name "*.db"
```

简单扫描 `../`、`/etc` 等字符串无法覆盖所有情况。

### 7.2 Shell 安全策略

| 安全项 | 建议 |
|---|---|
| 工作目录 | 固定 Workspace |
| 用户权限 | 独立低权限用户 |
| 文件系统 | 只挂载授权目录 |
| 网络访问 | 默认关闭 |
| 环境变量 | 清理敏感变量 |
| 进程权限 | 禁止提权 |
| 执行时间 | 设置超时 |
| 内存使用 | 设置限制 |
| CPU 使用 | 设置限制 |
| 进程数量 | 设置限制 |
| 命令范围 | 白名单或受限执行 |

### 7.3 最终安全边界

建议通过以下技术实现隔离：

- Docker 容器。
- Linux Namespaces。
- Linux Seccomp。
- AppArmor。
- SELinux。
- 独立用户和文件系统权限。

注意：容器本身也需要正确配置。不要挂载宿主机敏感目录，不要使用特权容器，也不要将 Docker Socket 暴露给不可信执行环境。

---

## 8. 符号链接安全

符号链接是路径安全中非常容易遗漏的环节。

例如：

```text
/workspace/
│
├── project/
│   └── secret -> /etc
│
└── output/
```

LLM 返回：

```text
project/secret/passwd
```

表面上路径属于 Workspace，但实际上最终访问的是：

```text
/etc/passwd
```

因此需要：

1. 检查路径中的符号链接。
2. 禁止未经授权的符号链接。
3. 检查解析后的真实路径。
4. 对高风险操作使用安全的文件描述符操作。
5. 防止路径检查后被其他进程替换。

建议默认禁止跟随符号链接。

---

## 9. 安全审计

建议所有工具调用都记录安全审计日志。

日志字段：

| 字段 | 说明 |
|---|---|
| request_id | 请求 ID |
| agent_id | Agent ID |
| tool_name | 工具名称 |
| operation | 操作类型 |
| original_path | 原始路径 |
| resolved_path | 规范化路径 |
| workspace | 工作空间 |
| permission | 使用的权限 |
| result | 执行结果 |
| security_action | 放行或拦截 |
| timestamp | 执行时间 |

日志示例：

```json
{
  "request_id": "req-001",
  "agent_id": "agent-001",
  "tool_name": "read_file",
  "operation": "read",
  "original_path": "../../etc/passwd",
  "resolved_path": null,
  "workspace": "/workspace",
  "result": "blocked",
  "security_action": "PATH_TRAVERSAL",
  "timestamp": "2026-11-18T16:00:00"
}
```

注意：日志应避免记录文件内容、密码、密钥及其他敏感数据。

---

## 10. 当前的项目目录结构

安全能力集中在 `tools/security/`，工具执行入口与工具实现同在 `tools/`，避免工具反向依赖 `core`。

安全检查与沙箱执行全部收敛在 `tool_executor.py`：工具只声明能力（`requires_approval`、`uses_sandbox`、`path_arguments`）并实现 `execute(context, request)`，不接触路径校验、权限判断或子进程；执行器负责准入、参数与路径校验、审批判定、沙箱执行和审计，并通过 `ToolContext` 把已校验的路径与受控沙箱交给工具。

```text
local/src/loong_local/
│
├── tools/
│   ├── tool_executor.py           # 统一执行入口：准入 → 参数校验 → 审批 → 执行 → 审计
│   ├── base_tool.py               # ABSTool、BaseToolParameters、挂起/未授权异常
│   ├── registry.py                # ToolRegistry 与 GLOBAL_TOOL_REGISTRY
│   │
│   ├── security/
│   │   ├── path_guard.py          # 路径规范化、工作区边界、符号链接、权限
│   │   ├── permission_guard.py    # 工具能力矩阵
│   │   ├── tool_guard.py          # 工具白名单与审批判定
│   │   ├── sandbox.py             # 受限执行：固定 cwd、清理 env、超时、资源限制
│   │   └── audit.py               # 安全审计
│   │
│   ├── filesystem/
│   │   ├── read_file.py     write_file.py      delete_file.py
│   │   ├── list_directory.py  search_files.py
│   │   └── create_directory.py  move_file.py    copy_file.py
│   │
│   └── shell/
│       └── shell_tool.py          # Shell 命令执行（一律视为高危）
│
```

放行策略不再放在独立的 `security.yaml`，而是：

- 网关默认值：`GatewayConfig.workspace_mode`（`read_only` / `workspace_write` / `full`）；
- 连接级覆盖：客户端 `X-Workspace-Policy` 请求头；
- 由 `SessionMiddleware` 解析后写入 `SSEContext.policy`，随工具调用传入 `PathGuard`。

尚未实现：`tools/python/`（Python 代码执行工具）。新增此类工具时按同一模式接入 `ToolExecutor` 与权限矩阵即可。

### 模块职责

| 模块 | 职责 |
|---|---|
| path_guard.py | 路径规范化、工作区边界、符号链接与权限检查 |
| permission_guard.py | 工具能力矩阵（read/write/delete/execute） |
| tool_guard.py | 工具白名单与是否需要人工审批 |
| sandbox.py | 受限执行：固定 cwd、清理环境变量、超时与输出上限 |
| audit.py | 安全审计日志（只记录路径与结论） |
| tool_executor.py | 统一执行入口，串起上述守卫与工具实现 |

---

## 11. 安全测试用例

至少需要覆盖以下场景：

| 测试场景 | 输入 | 预期 |
|---|---|---|
| 正常相对路径 | project/a.py | 允许 |
| 当前目录 | ./project/a.py | 允许 |
| 内部路径回退 | project/../output/a.txt | 默认拒绝（`allow_path_traversal=False`），开启后按权限决定 |
| 路径穿越 | ../../etc/passwd | 拒绝 |
| Linux 绝对路径 | /etc/passwd | 拒绝 |
| Windows 绝对路径 | C:\Windows\system.ini | 拒绝 |
| UNC 路径 | \\server\share\a.txt | 拒绝 |
| 空路径 | "" | 拒绝 |
| 空字节 | a.py\0.txt | 拒绝 |
| 外部符号链接 | project/link/passwd | 拒绝 |
| 不存在的文件 | project/notfound.py | 按操作类型处理 |
| 无写入权限 | uploads/a.txt | 拒绝写入 |
| 无删除权限 | project/a.py | 拒绝删除 |
| 未知工具 | tool_name 不在权限矩阵 | 拒绝调度 |

以上前 13 项已由 `local/tests/test_path_security.py` 覆盖；外部符号链接用例在无创建权限的 Windows 环境会自动跳过。

此外还需要测试（当前尚未自动化，需要操作系统级手段模拟）：

- 符号链接替换竞态。
- 目录替换竞态。
- Shell 命令替换。
- Shell 重定向。
- 环境变量访问。
- 子进程启动。
- 网络访问。
- 软链接与硬链接。
- 挂载点逃逸。

---

## 12. 最终架构建议

对于本地运行的 LLM Agent 工具执行引擎，建议采用以下设计：

### 第一层：Prompt 层

通过系统提示词告诉 LLM：

- 只能操作授权工作目录。
- 文件路径使用相对路径。
- 不允许访问系统目录。
- 不允许执行未授权操作。

这一层用于改善模型行为，不作为安全保障。

### 第二层：Tool Permission Guard

负责：

- 工具调用白名单。
- 工具参数校验。
- 工具权限管理。
- 高风险操作授权。

### 第三层：Path Security Manager

负责：

- 路径规范化。
- 路径穿越检测。
- 绝对路径限制。
- 符号链接检测。
- 文件读写权限检查。

### 第四层：Sandbox Executor

负责：

- 文件系统隔离。
- 进程隔离。
- 网络限制。
- 资源限制。
- 命令执行限制。

### 最终原则

**路径安全控制必须放在 Tool Executor 层，而不是仅仅放在 LLM Prompt 层。**

所有文件访问统一经过 Path Security Manager。

所有 Shell 和 Python 代码执行统一经过 Sandbox Executor。

LLM 只负责提出工具调用请求，不负责决定自己的访问权限。

这样后续无论增加文件操作、Shell、Python、代码执行还是其他本地工具，都可以复用同一套安全控制体系。
