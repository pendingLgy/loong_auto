# 测试

在仓库根目录执行：

```powershell
uv run --package loong-cloud python -m unittest discover -s cloud/tests -v
```

也可使用已声明的 pytest 开发依赖：

```powershell
uv run --package loong-cloud pytest cloud/tests
```

test_status.py 包含一个服务状态接口测试，通过内存中的测试应用发送请求，不启动网络服务、不调用模型，也不需要 .env。

已有完整云端集成测试仍保留在 engineering/tests，运行方式见该工程的构建与启动说明。
