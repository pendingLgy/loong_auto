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

```powershell
# cloud 全部单元测试
uv run --package loong-cloud python -m unittest discover -s cloud/tests -v

# 配置加载测试
uv run --package loong-cloud python -m unittest discover -s cloud/tests -p "test_loading_config.py" -v
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
