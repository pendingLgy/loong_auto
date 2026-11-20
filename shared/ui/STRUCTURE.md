# shared/ui 目录结构

## 目录树

```text
shared/ui/
├── index.html          # 预览入口
├── index.ts            # 包出口
├── package.json        # exports: "." / "./login" / "./server-config" / "./layout" / "./chat" / "./model-picker" / "./home-tabs" / "./dialog" / "./message" / "./icon" / "./nav" / "./settings" / "./task" / "./i18n"
├── preview/            # 组件画廊（不参与生产构建）
│   ├── main.tsx        # 左侧导航 + 右侧渲染，搜索、分组折叠
│   ├── cases/          # 每个组件一个用例文件
│   ├── types.ts        # PreviewCase
│   └── styles.css      # 仅预览入口使用
├── src/
│   ├── login/
│   │   ├── LoginPage.tsx
│   │   └── index.ts
│   ├── server-config/
│   │   ├── ServerConfigPage.tsx
│   │   └── index.ts
│   ├── layout/
│   │   ├── ThreePaneLayout.tsx
│   │   └── index.ts
│   ├── home-tabs/
│   │   ├── HomeTabs.tsx          # 首页顶部标签导航
│   │   └── index.ts
│   ├── dialog/
│   │   ├── Dialog.tsx            # 通用对话框
│   │   └── index.ts
│   ├── message/
│   │   ├── Message.tsx           # 静态消息提示
│   │   ├── Toast.tsx             # 自动关闭的浮动提示
│   │   └── index.ts
│   ├── assets/
│   │   └── icons/                # 每个图标一个 .svg
│   ├── icon/
│   │   └── index.ts              # 图标组件与内联 SVG 导出
│   ├── chat/
│   │   ├── LlmChat.tsx           # LLM 聊天面板
│   │   ├── MessageRow.tsx        # 单条消息展示
│   │   ├── MarkdownContent.tsx   # Markdown 渲染
│   │   ├── clipboard.ts          # 复制到剪贴板
│   │   ├── types.ts              # ChatMessage / ChatRole
│   │   └── index.ts
│   ├── model-picker/
│   │   ├── ModelPicker.tsx       # 模型选择弹窗
│   │   └── index.ts
│   ├── nav/
│   │   ├── SideNav.tsx           # 组合：Menu + Workspace
│   │   ├── SideNavMenu.tsx       # 主导航（新建对话 / 自动化任务）
│   │   ├── SideNavWorkspace.tsx  # 工作区列表
│   │   ├── SideNavUser.tsx       # 底部用户头像 + 名称操作栏
│   │   └── index.ts
│   ├── settings/
│   │   ├── SettingsPage.tsx            # 组合：Nav + 内容
│   │   ├── SettingsNav.tsx             # 左侧分组导航
│   │   ├── SettingsServerSection.tsx   # 服务器连接内容
│   │   ├── SettingsProviderSection.tsx # 模型供应商内容
│   │   ├── SettingsModelSection.tsx    # 模型内容
│   │   ├── SettingsAccountSection.tsx  # 账号内容
│   │   ├── types.ts                    # 公共类型
│   │   └── index.ts
│   └── task/
└── tsconfig.json       # 覆盖 src/login（task 待契约类型补齐）
```

- 组件按领域放 `src/<domain>/`，目录内用 `index.ts` 做 barrel；跨目录引用走包导出，不写相对路径穿透到别的领域。
- 新增组件时同步补 `preview/cases/<domain>.tsx` 用例，并在 `preview/cases/index.ts` 注册。
- 组件文件使用 `PascalCase.tsx`，非组件模块使用 `camelCase.ts`。
