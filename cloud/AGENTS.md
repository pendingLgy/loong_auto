# 云端模块协作规范

本文件适用于 `cloud` 目录及其子目录，与仓库根目录的 `AGENTS.md` 一并遵循。

## 配置定义

- `config` 包中的配置模型使用 Pydantic `BaseModel`，所有配置字段均通过 `Field` 显式声明。
- 使用 `Field` 定义默认值、字段说明及必要的校验约束；可变默认值使用 `default_factory`。
- 密码、令牌等敏感字段设置 `repr=False`，避免在模型表示中泄露。
- 不混用标准库 `dataclass`、`dataclasses.field` 与 Pydantic 模型。
- 配置文件读取、格式解析与加载入口集中在 `config/config_global.py`，支持将解析结果转换为 `GlobalConfig`。

## 测试

- 仅在用户明确要求时新增测试用例；修改代码后可以运行已有测试进行验证。
