# **Web Agent UI 设计规范**

## **1. 设计基础**

整体采用简洁、现代的 AI 工作台风格，以内容阅读和任务操作为核心。

- **设计风格：** Minimal、Professional、Clean
- **主色调：** 靛蓝紫色（Indigo）
- **主题模式：** Light / Dark 双主题
- **布局风格：** 面板式布局
- **圆角：** 6–12px
- **字体：** Inter + 中文系统字体
- **图标：** Lucide Icons
- **设计原则：** 降低视觉噪音、突出内容、统一交互反馈。

## **2. 字体规范（Typography）**

### **2.1 字体选择**

| 用途           | 字体                 |
| ------------ | ------------------ |
| 英文主字体        | Inter              |
| 中文主字体        | 思源黑体（Noto Sans SC） |
| 中文备用字体       | Microsoft YaHei    |
| Windows 系统字体 | Segoe UI           |
| Mac 系统字体     | PingFang SC        |
| 代码字体         | JetBrains Mono     |

推荐 CSS：

```
:root {
  --font-sans:
    "Inter",
    "Noto Sans SC",
    "PingFang SC",
    "Microsoft YaHei",
    sans-serif;

  --font-mono:
    "JetBrains Mono",
    "SFMono-Regular",
    Consolas,
    monospace;
}
```

### **2.2 字号规范**

| 类型    | 字号   | 字重  | 行高  |
| ----- | ---- | --- | --- |
| 页面主标题 | 24px | 600 | 1.4 |
| 页面标题  | 20px | 600 | 1.4 |
| 模块标题  | 16px | 600 | 1.5 |
| 卡片标题  | 14px | 600 | 1.5 |
| 正文    | 14px | 400 | 1.7 |
| 次级正文  | 13px | 400 | 1.6 |
| 辅助文字  | 12px | 400 | 1.5 |
| 按钮文字  | 13px | 500 | 1.4 |
| 代码    | 13px | 400 | 1.6 |

建议正文默认使用 14px，避免工作台长时间使用时产生视觉疲劳。

## **3. 品牌主题色（Brand Colors）**

采用 Indigo 作为品牌主色，蓝紫色能够体现 AI 产品的科技感，同时保持专业、克制的视觉效果。

**Primary — Indigo 500**

# **&#x20;#6366F1&#x20;**

品牌主色 / 主要按钮 / 激活状态

\#EEF2FF

\#E0E7FF

\#C7D2FE

\#818CF8

\#4F46E5

### **3.1 品牌色使用规范**

| 色彩          | HEX       | 用途             |
| ----------- | --------- | -------------- |
| Primary 50  | `#EEF2FF` | 浅色背景           |
| Primary 100 | `#E0E7FF` | Hover 背景       |
| Primary 200 | `#C7D2FE` | 边框、选中背景        |
| Primary 400 | `#818CF8` | 暗色模式强调         |
| Primary 500 | `#6366F1` | 品牌主色           |
| Primary 600 | `#4F46E5` | Hover / Active |
| Primary 700 | `#4338CA` | 深色文字强调         |

## **4. 功能状态色（Semantic Colors）**

| 状态      | Light     | Dark      | 用途      |
| ------- | --------- | --------- | ------- |
| Success | `#16A34A` | `#4ADE80` | 成功、完成   |
| Warning | `#D97706` | `#FBBF24` | 警告、等待确认 |
| Error   | `#DC2626` | `#F87171` | 失败、错误   |
| Info    | `#2563EB` | `#60A5FA` | 信息、提示   |
| Running | `#6366F1` | `#818CF8` | 正在执行    |
| Pending | `#64748B` | `#94A3B8` | 等待执行    |

状态色应主要用于图标、状态标签、边框和提示，不要大面积铺色。

## **5. Light Theme 颜色规范**

浅色模式以白色为主体，背景采用轻微灰色，避免整个页面纯白造成视觉疲劳。

## **Light Theme Preview**

**Agent Workspace**

Completed

这是浅色主题下的正文内容示例。

Agent 执行摘要

任务已完成，正在整理最终结果。

发送任务

取消

| Token             | HEX       | 用途         |
| ----------------- | --------- | ---------- |
| Background        | `#F7F8FA` | 页面背景       |
| Surface           | `#FFFFFF` | 卡片、主面板     |
| Surface Secondary | `#F3F4F6` | 次级面板       |
| Surface Tertiary  | `#EDEFF2` | Hover、输入背景 |
| Border            | `#E5E7EB` | 默认边框       |
| Border Strong     | `#D1D5DB` | 强调边框       |
| Text Primary      | `#111827` | 主要文字       |
| Text Secondary    | `#4B5563` | 次要文字       |
| Text Tertiary     | `#9CA3AF` | 辅助文字       |
| Text Disabled     | `#D1D5DB` | 禁用文字       |

## **6. Dark Theme 颜色规范**

暗色模式以深灰蓝为基础，不建议使用纯黑色。通过不同亮度的 Surface 区分工作区、卡片和浮层。

## **Dark Theme Preview**

**Agent Workspace**

Completed

这是暗色主题下的正文内容示例。

Agent 执行摘要

任务已完成，正在整理最终结果。

发送任务

取消

| Token             | HEX       | 用途         |
| ----------------- | --------- | ---------- |
| Background        | `#111318` | 页面背景       |
| Surface           | `#191D25` | 卡片、主面板     |
| Surface Secondary | `#252B36` | 次级面板       |
| Surface Tertiary  | `#303744` | Hover、输入背景 |
| Border            | `#303744` | 默认边框       |
| Border Strong     | `#414B5B` | 强调边框       |
| Text Primary      | `#F9FAFB` | 主要文字       |
| Text Secondary    | `#D1D5DB` | 次要文字       |
| Text Tertiary     | `#9CA3AF` | 辅助文字       |
| Text Disabled     | `#6B7280` | 禁用文字       |

## **7. UI 组件规范**

### **7.1 圆角（Border Radius）**

| Token       | 数值     | 用途        |
| ----------- | ------ | --------- |
| radius-xs   | 4px    | 小标签       |
| radius-sm   | 6px    | 小按钮、输入框   |
| radius-md   | 8px    | 普通按钮、卡片   |
| radius-lg   | 12px   | 面板、弹窗     |
| radius-xl   | 16px   | 大型抽屉、浮层   |
| radius-full | 9999px | 圆形按钮、状态标签 |

### **7.2 间距（Spacing）**

采用 4px 基础间距体系。

| Token    | 数值   | 用途     |
| -------- | ---- | ------ |
| space-1  | 4px  | 图标间距   |
| space-2  | 8px  | 紧凑间距   |
| space-3  | 12px | 组件内部间距 |
| space-4  | 16px | 标准间距   |
| space-5  | 20px | 模块间距   |
| space-6  | 24px | 区块间距   |
| space-8  | 32px | 大区块间距  |
| space-10 | 40px | 页面级间距  |

### **7.3 按钮（Button）**

| 类型        | 规范         |
| --------- | ---------- |
| Primary   | 品牌色背景，白色文字 |
| Secondary | 次级背景，主要文字  |
| Outline   | 透明背景，边框    |
| Ghost     | 无背景、无边框    |
| Danger    | 错误色背景或文字   |
| Disabled  | 降低对比度，禁止交互 |

按钮高度：

- Small：28px
- Medium：36px
- Large：40px

### **7.4 输入框（Input）**

- 默认高度：36px。
- 圆角：8px。
- 默认边框：Border。
- Focus：Primary 边框 + 轻微外发光。
- Disabled：使用 Surface Secondary。
- Placeholder：Text Tertiary。

### **7.5 卡片（Card）**

- 背景：Surface。
- 边框：1px solid Border。
- 圆角：12px。
- 内边距：16px。
- 卡片之间间距：12–16px。
- Hover 时可以轻微改变背景，不建议明显放大或跳动。

## **8. Web Agent 专属组件规范**

| 组件               | 视觉规范                    |
| ---------------- | ----------------------- |
| User Message     | 使用轻量背景区分用户消息            |
| Agent Message    | 默认透明背景，突出内容             |
| Thinking Summary | 使用次级背景，可折叠              |
| Tool Call        | 使用卡片容器，显示工具名称和执行状态      |
| Task Plan        | 使用步骤列表和状态图标             |
| Running Status   | 品牌色状态标识                 |
| Completed Status | Success 状态色             |
| Failed Status    | Error 状态色               |
| Citation         | 小字号、弱化颜色、可点击            |
| Artifact Card    | Surface 背景、边框、文件图标      |
| Chat Input       | Surface 背景、明显的 Focus 状态 |
| Document Drawer  | Surface 背景，与主工作区通过边框区分  |

## **9. 图标规范（Icons）**

使用 Lucide Icons。

| 属性   | 规范             |
| ---- | -------------- |
| 默认尺寸 | 16px           |
| 小图标  | 14px           |
| 中图标  | 18px           |
| 大图标  | 20px           |
| 页面图标 | 24px           |
| 描边宽度 | 1.75px         |
| 默认颜色 | Text Secondary |
| 激活颜色 | Primary        |
| 禁用颜色 | Text Disabled  |

## **10. 阴影与层级（Elevation）**

| 层级      | Light                        | Dark                        |
| ------- | ---------------------------- | --------------------------- |
| Level 0 | 无阴影                          | 无阴影                         |
| Level 1 | `0 1px 2px rgba(0,0,0,.04)`  | `0 1px 2px rgba(0,0,0,.2)`  |
| Level 2 | `0 4px 12px rgba(0,0,0,.08)` | `0 4px 12px rgba(0,0,0,.3)` |
| Level 3 | `0 8px 24px rgba(0,0,0,.12)` | `0 8px 24px rgba(0,0,0,.4)` |

暗色模式优先通过背景亮度、边框和遮罩表达层级，不要依赖大量阴影。

## **11. 动效规范（Motion）**

| 场景           | 时间    | 动效     |
| ------------ | ----- | ------ |
| Hover        | 120ms | 颜色渐变   |
| Button Press | 100ms | 轻微缩放   |
| Drawer       | 200ms | 水平滑入   |
| Modal        | 180ms | 淡入     |
| Tooltip      | 120ms | 淡入     |
| Theme Switch | 180ms | 颜色过渡   |
| Loading      | 持续    | 旋转或骨架屏 |

统一使用：

```
transition:
  color 150ms ease,
  background-color 150ms ease,
  border-color 150ms ease,
  opacity 150ms ease;
```

## **12. 主题切换规范**

支持三种模式：

- Light：始终使用浅色主题。
- Dark：始终使用暗色主题。
- System：跟随操作系统主题。

主题切换应满足：

- 全局统一切换，所有组件同步变化。
- 用户选择持久化保存。
- 页面刷新后保持主题。
- 抽屉、弹窗、下拉菜单等浮层必须同步切换。
- 图表、代码块、Markdown、表格需要提供对应主题样式。
- 不允许部分组件仍然使用固定的浅色背景。

推荐使用 CSS Variables 实现主题系统。

## **13. CSS Variables 主题变量**

下面的变量可以直接作为项目的基础设计 Token。

```
:root,
[data-theme="light"] {
  color-scheme: light;

  --color-primary: #6366F1;
  --color-primary-hover: #4F46E5;
  --color-primary-active: #4338CA;
  --color-primary-subtle: #EEF2FF;

  --color-background: #F7F8FA;
  --color-surface: #FFFFFF;
  --color-surface-secondary: #F3F4F6;
  --color-surface-tertiary: #EDEFF2;

  --color-border: #E5E7EB;
  --color-border-strong: #D1D5DB;

  --color-text-primary: #111827;
  --color-text-secondary: #4B5563;
  --color-text-tertiary: #9CA3AF;
  --color-text-disabled: #D1D5DB;

  --color-success: #16A34A;
  --color-warning: #D97706;
  --color-error: #DC2626;
  --color-info: #2563EB;

  --color-overlay: rgb(17 24 39 / 40%);
}

[data-theme="dark"] {
  color-scheme: dark;

  --color-primary: #818CF8;
  --color-primary-hover: #A5B4FC;
  --color-primary-active: #6366F1;
  --color-primary-subtle: #252B45;

  --color-background: #111318;
  --color-surface: #191D25;
  --color-surface-secondary: #252B36;
  --color-surface-tertiary: #303744;

  --color-border: #303744;
  --color-border-strong: #414B5B;

  --color-text-primary: #F9FAFB;
  --color-text-secondary: #D1D5DB;
  --color-text-tertiary: #9CA3AF;
  --color-text-disabled: #6B7280;

  --color-success: #4ADE80;
  --color-warning: #FBBF24;
  --color-error: #F87171;
  --color-info: #60A5FA;

  --color-overlay: rgb(0 0 0 / 60%);
}
```

## **14. 设计规范总结**

| 设计项目   | 最终规范                  |
| ------ | --------------------- |
| 品牌主色   | Indigo `#6366F1`      |
| 暗色主题背景 | `#111318`             |
| 浅色主题背景 | `#F7F8FA`             |
| 英文字体   | Inter                 |
| 中文字体   | Noto Sans SC          |
| 代码字体   | JetBrains Mono        |
| 默认字号   | 14px                  |
| 默认圆角   | 8px                   |
| 卡片圆角   | 12px                  |
| 基础间距   | 4px                   |
| 默认图标   | Lucide                |
| 按钮高度   | 36px                  |
| 主题模式   | Light / Dark / System |
| 动效时间   | 150–200ms             |

**整体视觉方向：** 以 Indigo 为品牌识别色，以中性灰作为基础色彩体系，浅色模式强调清晰、明亮，暗色模式强调沉浸、专注。两种主题共享同一套组件结构、间距、字号和交互规范。
