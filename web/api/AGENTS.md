# web/api 协作规范

本文作用于 `web/api`，补充 [web/AGENTS.md](../AGENTS.md)。

## 职责

- 本包只提供接口契约、endpoint 配置与通用类型。
- 不发起 HTTP 请求，不解析响应，不处理错误或国际化。
- 实际调用由 `web/app` 的 `runtime/http` 负责。

## 目录

```text
src/
├── core.ts
├── config.ts
├── endpoints/
├── types/
└── index.ts
```

- `core.ts`：`HttpMethod`、`Endpoint`、`defineEndpoint`。
- `endpoints/`：按业务域定义 endpoint 常量。
- `types/`：请求 / 响应接口。
- `config.ts`：路径参数替换等纯工具。
- `index.ts`：统一导出。

## Endpoint

所有接口使用：

```ts
export const AUTH_ENDPOINTS = {
  login: defineEndpoint<LoginRequest, LoginResponse>(
    "POST",
    "/api/cloud/common/api/auth/login",
  ),
} as const;
```

API 接口使用运行时配置的类型：

```ts
export interface AuthApi {
  login: typeof AUTH_ENDPOINTS.login;
}
```

规则：

- endpoint 常量按域导出；
- 一个 endpoint 只定义方法、路径与请求 / 响应类型；
- 路径参数使用 `{name}`；
- 不在本包写 fetch、headers、错误处理或重试。

## 类型命名

- 请求：`XxxRequest`。
- 响应：`XxxResponse`。
- 原始载荷：`RawXxxResponse`。
- 列表参数：`XxxListRequest`。
- 分页响应：`XxxPageResponse`。

## 字段命名

所有接口字段统一使用 snake_case：

```ts
export interface UserInfoResponse {
  tenant_id: string;
  username: string;
}
```

TypeScript 接口字段与后端 JSON 字段保持一致，不在应用层做字段名转换。

## 新增接口

1. 在 `types/` 添加 `XxxRequest` / `XxxResponse`。
2. 在对应 `endpoints/` 文件添加 `defineEndpoint`。
3. 在 API 接口中使用 `typeof ENDPOINTS.xxx`。
4. 在 `endpoints/index.ts` 导出。
5. 在应用侧 `runtime/http/api_client.ts` 绑定该 endpoint 模块。

## 约束

- 不引入 HTTP 客户端、错误类或 i18n。
- 不直接依赖 `web/app`。
- 不导出 React / Solid 组件。
- `Endpoint` 的 `_req` / `_res` 仅用于类型绑定，无运行时开销。

## 验证

```powershell
bun run --filter '@loong/web-api' typecheck
bun run --filter '@loong/web-api' build
```

`dist` 由应用消费；修改类型后必须重新构建。
