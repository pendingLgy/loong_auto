# Python 工程 uv 构建手册

本手册面向仓库根目录的 Python 工作区，覆盖环境初始化、依赖管理、运行、测试、构建与 Ruff 检查。

前端（Bun）相关命令见 [BUILD.md](BUILD.md)；各模块自身的启动与配置见 `cloud/BUILD.md`、`local/BUILD.md`。

## 1. 环境要求

- Python `>=3.12`；
- uv 已安装；
- Windows 使用 PowerShell；
- 所有命令默认在**仓库根目录**执行，不要在子包目录单独创建环境。

检查版本：

```powershell
uv --version
uv python list
```

安装或切换 Python：

```powershell
uv python install 3.12
uv python pin 3.12
```

`uv python pin` 会在当前目录写入 `.python-version`，团队需要统一版本时再提交该文件。

## 2. 工作区结构

根 [pyproject.toml](pyproject.toml) 定义 uv workspace：

```text
loong_auto/
├── pyproject.toml          # workspace 根，package = false
├── uv.lock                 # 全工作区统一锁文件
├── shared/
│   ├── contracts/          # loong-contracts
│   └── cloud_client/       # loong-cloud-client
├── local/                  # loong-local
└── cloud/                  # loong-cloud
```

- 根项目不是可安装包（`package = false`），只负责工作区、约束和开发依赖；
- 成员包的依赖统一解析到根 `uv.lock`；
- 不在成员目录单独执行 `uv lock` 或提交独立锁文件；
- 命令通过 `--package <名称>` 指定目标成员，例如 `--package loong-cloud`。

## 3. 首次初始化

安装所有成员包与开发依赖：

```powershell
uv sync --all-packages --group dev
```

说明：

- `--all-packages`：同步所有 workspace 成员；
- `--group dev`：包含根 `[dependency-groups].dev`（当前为 Ruff）；
- uv 会在根目录创建 `.venv`；
- 提交 `pyproject.toml`、成员 `pyproject.toml` 与 `uv.lock`；
- 不提交 `.venv/`、`__pycache__/`、构建产物。

只同步单个包：

```powershell
uv sync --package loong-cloud
```

只安装开发依赖、不安装成员默认依赖：

```powershell
uv sync --only-group dev
```

生产环境不安装 dev 组：

```powershell
uv sync --no-dev
```

## 4. 运行代码

在 workspace 环境中运行模块：

```powershell
uv run --package loong-cloud python -m loong_cloud --path cloud/.env
```

```powershell
uv run --package loong-local python -m loong_local
```

执行任意 Python 表达式或脚本：

```powershell
uv run --package loong-cloud python -c "import loong_cloud; print('ok')"
```

只查看环境中的包：

```powershell
uv pip list
uv tree --package loong-cloud
```

## 5. 依赖管理

### 5.1 新增运行依赖

给指定成员新增依赖：

```powershell
uv add --package loong-cloud httpx
```

```powershell
uv add --package loong-local websockets
```

workspace 内部依赖使用工作区解析，不要写成固定版本：

```powershell
uv add --package loong-cloud loong-contracts
```

### 5.2 新增开发依赖

根开发依赖组（全工作区共享）：

```powershell
uv add --dev ruff
```

给指定成员新增开发依赖：

```powershell
uv add --package loong-cloud --dev pytest
```

### 5.3 移除依赖

```powershell
uv remove --package loong-cloud httpx
uv remove --dev ruff
```

### 5.4 更新依赖

只更新锁文件中的版本解析：

```powershell
uv lock --upgrade
```

只升级单个包：

```powershell
uv lock --upgrade-package pydantic
```

升级后重新同步：

```powershell
uv sync --all-packages
```

查看依赖树与冲突：

```powershell
uv tree
uv tree --package loong-cloud
```

根 `pyproject.toml` 的 `[tool.uv].constraint-dependencies` 用于约束全工作区共享依赖的版本范围；新增共享约束时同步检查所有成员是否仍能解析。

### 5.5 锁文件规则

- `uv.lock` 必须提交；
- 正常 `uv sync`、`uv add`、`uv remove` 会自动更新锁文件；
- CI 或部署环境使用冻结安装：

```powershell
uv sync --frozen --all-packages
```

- 只检查锁文件是否最新，不改写：

```powershell
uv lock --check
```

- 只有确认需要完全重建解析时才删除 `uv.lock`，删除后重新执行 `uv lock` 与 `uv sync`。

## 6. Ruff 代码检查与格式化

Ruff 位于根 dev 依赖组，使用 `uv run` 执行，不需要手动激活虚拟环境。

### 6.1 基础检查

```powershell
uv run ruff check .
```

只检查指定目录：

```powershell
uv run ruff check cloud
uv run ruff check shared/contracts
```

输出更简洁：

```powershell
uv run ruff check . --output-format concise
```

统计问题数量：

```powershell
uv run ruff check . --statistics
```

### 6.2 自动修复

安全修复：

```powershell
uv run ruff check . --fix
```

仅整理导入顺序：

```powershell
uv run ruff check --select I --fix .
```

允许不安全的修复（需要逐项确认）：

```powershell
uv run ruff check . --fix --unsafe-fixes
```

预览将要修改的内容：

```powershell
uv run ruff check . --fix --diff
```

### 6.3 格式化

格式化全部代码：

```powershell
uv run ruff format .
```

只检查格式、不写文件：

```powershell
uv run ruff format --check .
```

查看格式差异：

```powershell
uv run ruff format --diff .
```

只格式化指定目录：

```powershell
uv run ruff format cloud local shared
```

### 6.4 指定规则

只检查导入顺序：

```powershell
uv run ruff check --select I .
```

检查常见错误与未使用导入：

```powershell
uv run ruff check --select E,F .
```

忽略某条规则：

```powershell
uv run ruff check . --ignore E501
```

### 6.5 配置位置

Ruff 配置统一放在根 `pyproject.toml`，不要在每个成员包重复维护。示例：

```toml
[tool.ruff]
line-length = 120
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
```

修改配置后先运行：

```powershell
uv run ruff check .
uv run ruff format --check .
```

### 6.6 推荐提交前检查

```powershell
uv run ruff check . --fix
uv run ruff format .
uv run ruff check .
uv run ruff format --check .
```

## 7. 测试

运行单个测试文件：

```powershell
uv run --package loong-cloud python -m pytest cloud/tests/test_message_store.py -q
```

运行某个目录：

```powershell
uv run --package loong-cloud python -m pytest cloud/tests -q
```

只收集用例、不执行：

```powershell
uv run --package loong-cloud python -m pytest cloud/tests --collect-only -q
```

运行指定用例：

```powershell
uv run --package loong-cloud python -m pytest cloud/tests/test_message_store.py::test_add_message_and_append_history -q
```

说明：

- `cloud/tests/test_message_api.py`、`test_events_api.py` 等是真实 HTTP 集成测试，需要先单独启动 cloud 服务；
- 涉及模型调用的测试需要配置 `DEEPSEEK_API_KEY`；
- 仅完成 `--collect-only` 不能声称测试通过。

## 8. 构建

构建指定成员为 wheel/sdist：

```powershell
uv build --package loong-cloud
```

```powershell
uv build --package loong-contracts
```

构建产物默认输出到成员目录或根目录的 `dist/`，构建后检查：

```powershell
Get-ChildItem cloud/dist
```

构建全部 workspace 成员：

```powershell
uv build --all-packages
```

也可以逐个构建：

```powershell
uv build --package loong-contracts
uv build --package loong-cloud-client
uv build --package loong-local
uv build --package loong-cloud
```

不提交 `dist/`、`build/` 与 `*.egg-info/`。

## 9. 故障排查

### 锁文件与依赖不一致

```powershell
uv lock --check
uv sync --all-packages
```

### 环境损坏或依赖异常

```powershell
uv sync --all-packages --reinstall
```

必要时清理缓存：

```powershell
uv cache clean
```

### 找不到 workspace 成员

确认根 `pyproject.toml` 的 `[tool.uv.workspace].members` 包含目标目录，然后：

```powershell
uv sync --all-packages
```

### Python 版本不匹配

```powershell
uv python list
uv python install 3.12
uv python pin 3.12
uv sync --all-packages
```

### Windows 文件占用

关闭正在运行的服务、测试进程或编辑器中的 Python 进程后重试。不要在进程占用 `.venv` 时强制删除目录。

## 10. 命令速查

| 目的 | 命令 |
|---|---|
| 同步全部成员与 dev 依赖 | `uv sync --all-packages --group dev` |
| 同步单个成员 | `uv sync --package loong-cloud` |
| 冻结安装 | `uv sync --frozen --all-packages` |
| 检查锁文件 | `uv lock --check` |
| 升级锁文件 | `uv lock --upgrade` |
| 升级单个依赖 | `uv lock --upgrade-package pydantic` |
| 新增依赖 | `uv add --package loong-cloud httpx` |
| 新增 dev 依赖 | `uv add --dev ruff` |
| 移除依赖 | `uv remove --package loong-cloud httpx` |
| 运行模块 | `uv run --package loong-cloud python -m loong_cloud --path cloud/.env` |
| Ruff 检查 | `uv run ruff check .` |
| Ruff 修复 | `uv run ruff check . --fix` |
| Ruff 导入排序 | `uv run ruff check --select I --fix .` |
| Ruff 格式化 | `uv run ruff format .` |
| Ruff 格式检查 | `uv run ruff format --check .` |
| 运行测试 | `uv run --package loong-cloud python -m pytest cloud/tests -q` |
| 构建包 | `uv build --package loong-cloud` |

## 11. 推荐工作流

1. `uv sync --all-packages --group dev`
2. 修改代码或依赖；
3. `uv run ruff check . --fix`
4. `uv run ruff format .`
5. 运行相关测试；
6. `uv lock --check`
7. `uv build --package <目标包>`
8. 提交 `pyproject.toml`、成员配置、`uv.lock` 与代码变更。
