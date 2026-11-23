# web 构建与使用

Web 端由 Bun + Vite + SolidJS 管理，只允许配置一个本地网关服务器。业务请求经本地网关访问云端，页面不直连云端接口。

## 环境与依赖

- Bun、Node.js、TypeScript 与 Vite 版本在仓库根 `package.json` 的 `workspaces.catalog` 中维护。
- `@loong/ui` 通过 `workspace:*` 从源码消费；`@loong/client` 提供 Effect 本地网关客户端。
- `eventsource-parser` 用于解析聊天 SSE。

## 开发

```powershell
bun install
bun run --filter '@loong/web' dev
```

## 构建与检查

```powershell
bun run --filter '@loong/web' typecheck
bun run build:web
```

## 目录结构

```text
web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx                    # 挂载入口
    ├── App.tsx                     # 根组件与全局提示
    ├── api.ts                      # 唯一本地网关客户端
    ├── routers/                    # 路由与守卫
    ├── storage/
    │   ├── server_config.ts        # 唯一服务器配置
    │   ├── user.ts                 # 唯一登录会话
    │   ├── workspace.ts            # 工作区界面状态
    │   ├── chat_messages.ts        # 按 session 保存聊天消息与打字机
    │   ├── app_notice.ts           # 全局 Message 提示
    │   └── theme.ts
    ├── chat/
    │   └── executor.ts             # 消息队列与 SSE 执行器
    └── views/
        ├── workspace/
        │   ├── HomeView.tsx   # 根工作区页面
        │   └── LoginView.tsx
        ├── server-config/
        │   └── WebServerConfigView.tsx
        ├── workspace/
        │   ├── WorkspaceView.tsx
        │   └── workspace_context.tsx
        └── settings/
            └── WebSettingsView.tsx
```

## 路由、配置与登录

```text
/setup     未配置服务器时展示；已配置 → /
/          未配置 → /setup；否则 HomeView
/settings  未配置 → /setup；否则 WebSettingsView
```

- 只允许一个服务器配置，保存在 `loong.web.server-config`。
- `saveServerConfig` 覆盖唯一配置；`clearServerConfig` 清除配置；`updateServerStatus` 更新连通状态。
- 旧版 `{ servers: [...] }` 配置会自动取第一个服务器迁移为单对象。
- 登录不再使用独立 `/login` 路由，`HomeView` 在未登录时展示不可关闭的 `LoginView`。
- 登录成功后用户数据写入 `loong.web.user`，不再按服务器 ID 分区。
- `createApiClient()` 使用唯一服务器地址、`security_token` 与用户会话；401 时用唯一 refresh token 刷新并重试一次。

## 存储

| 内容 | Key |
|---|---|
| 唯一服务器配置 | `loong.web.server-config` |
| 登录会话 | `loong.web.user` |
| 工作区界面状态（布局、菜单、工作区/对话、选中模型） | `loong.web.workspace` |
| 已打开的工作区/会话标签与固定标签 | `loong.web.workspace-tabs` |
| 聊天消息（按 session） | `loong.web.chat-messages:<sessionId>` |
| 已加载消息页码 | `loong.web.chat-pages:<sessionId>` |
| 待发送消息队列 | `loong.web.chat-queue` |
| 主题 | `loong.web.theme` |

## 消息发送与 SSE

- 新建对话使用 UUID 作为 session ID；首次发送时以消息前 5 个字符为标题创建云端 session。
- 点击左侧工作区会话时，将其加入顶部 `HomeTabs`，标签为「工作区 / 会话」，并切换到对应 `LlmChat`；切换或关闭标签时，将离开的会话助手消息标记为历史。
- 会话行 hover 显示编辑按钮，修改标题调用 `client.session.update` 并同步工作区、标签标题。
- 新建工作区与选择工作区分别使用 `WorkspaceCreate`、`WorkspaceSelect` 弹窗；新建支持多个工作目录，提交调用 `client.workspace.create`。
- 点击「新建对话」会创建未归属工作区的会话标签，工作区选择保持为空；选择工作区后才允许发送并关联会话。
- 会话本地无消息缓存时，分页调用 `message.list` 拉取首页；滚动到顶部时继续加载更早消息并前插。
- `src/chat/executor.ts` 按 `sessionId` 保存待发送队列，队列持久化到 `loong.web.chat-queue`。
- 全局只维护一个 SSE 订阅；队列或执行中任务未清空时不关闭。
- 队列为空且收到 `heartbeat` 后启动 10 秒计时，期间仍无工作则关闭 SSE；新消息入队会取消关闭。
- SSE 事件中的助手消息写入 `loong.web.chat-messages:<sessionId>`，`LlmChat` 通过 `useTypewriterMessages` 逐字渲染。
- 详细架构见 [聊天消息执行器](chat-executor.md)。

## 登录

- `HomeView` 在服务器未登录时展示 `@loong/ui/login` 的 `LoginDialog`，遮罩、Esc 与关闭按钮不可用。
- 登录成功保存 `loong.web.user`，注册成功后自动登录。
- `/settings` 账号分组提供退出登录；退出会清空账号、工作区、标签、聊天与队列数据，但保留服务器配置，返回 `/` 重新登录。
- 顶部栏提供主题切换与退出登录；退出会清空账号与工作区数据，但保留服务器配置，返回 `/` 重新登录。

## 验证

- 清空 `localStorage` → 进入 `/setup`。
- 保存服务器配置 → 进入 `/` 并弹出登录框。
- 登录成功 → 进入唯一工作区。
- 刷新页面 → 服务器配置、登录态、工作区状态与聊天消息恢复。
- 修改存储或 API 后至少执行 `typecheck` 与 `build:web`。
