# 云端服务常用命令

以下命令在仓库根目录的 PowerShell 中执行。

## 启动

```powershell
uv run --package loong-cloud loong-cloud
```

或使用模块入口：

```powershell
# --path指定配置文件路径
uv run --package loong-cloud python -m loong_cloud --path=F:\workspace\code\python\loong_auto\cloud\.env 
```

## 测试

pytest 在顶层 `pyproject.toml` 配置 `asyncio_mode = "auto"`，自动运行原生 `async def` 测试，无需逐个添加 `@pytest.mark.asyncio`。普通配置 fixture 使用 `@pytest.fixture`；异步 fixture 可使用 `@pytest_asyncio.fixture`，默认每个测试使用独立事件循环。executor 测试使用 pytest 执行。

```powershell
# 同步云端及其测试依赖
uv sync --package loong-cloud --extra test

# executor 模拟测试（排除真实模型调用）
uv run --package loong-cloud --extra test python -m pytest cloud/tests/test_executor.py -k "not live" -v

# cloud 全部单元测试
uv run --package loong-cloud --extra test python -m pytest cloud/tests -v

# 指定文件
uv run --package loong-cloud --extra test python -m pytest cloud/tests/test_executor.py -v

# 指定文件中的独立测试函数
uv run --package loong-cloud --extra test python -m pytest cloud/tests/test_events_api.py::test_submit_message_pushes_dialogue_to_sse -v

# 指定文件中的类
uv run --package loong-cloud --extra test python -m pytest cloud/tests/test_executor.py::TestModelExecutor -v

# 指定类中的方法
uv run --package loong-cloud --extra test python -m pytest cloud/tests/test_executor.py::TestModelExecutor::test_complete -v


```

## 更新依赖

```powershell
# 按现有锁文件同步云端依赖
uv sync --package loong-cloud

# 更新工作区锁文件中允许范围内的依赖版本，再同步云端环境
uv lock --upgrade
uv sync --package loong-cloud
```

依赖版本范围在根 `pyproject.toml` 管理，云端所需依赖在 `cloud/pyproject.toml` 声明；`uv lock --upgrade` 会更新整个工作区共用的 `uv.lock`。

## 可选依赖

可选依赖通过 `--extra` 启用，不指定时使用基础依赖（默认 SQLite）。

| 名称 | 用途 | 依赖 |
| --- | --- | --- |
| `test` | 运行 pytest 测试 | pytest、pytest-asyncio |
| `mysql` | MySQL 数据库驱动 | pymysql[rsa]、asyncmy |
| `postgres` | PostgreSQL 数据库驱动 | psycopg[binary]、asyncpg |

```powershell
# 安装指定可选依赖
uv sync --package loong-cloud --extra test
uv sync --package loong-cloud --extra mysql
uv sync --package loong-cloud --extra postgres

# 组合使用，例如 MySQL 与测试依赖
uv sync --package loong-cloud --extra mysql --extra test

# 安装云端全部可选依赖
uv sync --package loong-cloud --all-extras

# 运行时也指定所需可选依赖
uv run --package loong-cloud --extra mysql python -m loong_cloud --path cloud/.env
uv run --package loong-cloud --extra test python -m pytest cloud/tests/test_executor.py -k "not live" -v
```

`uv sync` 会同步依赖环境，后续同步或运行时应继续指定需要的 `--extra`，避免已安装的可选依赖被移除。安装数据库驱动后，还需在服务配置中选择对应数据库并配置连接信息；`--extra` 本身不会切换数据库。
