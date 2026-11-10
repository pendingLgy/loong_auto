# Python 工程管理

采用 uv workspace：根 pyproject.toml 的 constraint-dependencies 统一约束运行依赖版本，子包的 project.dependencies 仅声明自身使用的依赖名称。所有成员共享根 uv.lock。

| 成员 | 导入名 | 依赖范围 |
| --- | --- | --- |
| shared/contracts | loong_contracts | Pydantic |
| local | loong_local | 公共契约、FastAPI、Uvicorn；按实现逐步增加 |
| cloud | loong_cloud | 公共契约、Pydantic、FastAPI、Uvicorn、HTTPX、SQLAlchemy |

根约束不会自动安装依赖；子包必须显式声明实际依赖。workspace 内部依赖通过 tool.uv.sources 引用。根开发依赖统一管理测试和检查工具。构建后端由子包单独声明，不属于运行依赖。

后续执行示例（此次没有执行依赖管理命令）：

```text
uv sync --all-packages
uv run --package loong-cloud loong-cloud
uv run --package loong-local loong-local
uv run --package loong-cloud python -m loong_cloud
uv run --package loong-local python -m loong_local
uv run --package loong-cloud python -m unittest discover -s engineering/tests -v
uv run --package loong-contracts python -m loong_contracts.export
```

服务启动类分别为 CloudApplication 和 LocalApplication。入口为服务进程启动用途，不增加用户 CLI 产品入口。本地网关目前只有健康检查骨架，尚未实现认证和业务转发。

根 uv 约束只在本工程解析时生效，独立发布子包前需要补充并验证其发行依赖范围。Python 源码继续使用 src 布局，不修改 sys.path。TypeScript 依赖由 Bun 管理。
