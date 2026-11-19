# shared/ui 协作规范

本文作用于 `shared/ui`，补充根目录 [AGENTS.md](../../AGENTS.md)；与根规范冲突时，以本文对 UI 的额外要求为准。

## 职责边界

- 本目录只放 **Web 与 Electron 共用的 SolidJS DOM 组件**，不放 TUI 组件、网络客户端或业务编排。
- 组件必须是纯展示 + 交互：不读取网关地址、不认识 `platform`、不 import `@loong/client`，不持有 `LoginSession` 之类的领域类型。
- 业务数据、校验规则、提交动作通过 props 注入；可见文案统一通过 `translate` 获取（中文以内联 fallback 为准，其它语言在 `src/i18n` 字典），不通过 props 传递文案。
- 网关/平台/持久化属于消费端（`web/src/pages`、`desktop/renderer`）或 `shared/client`，不得下沉到组件。
- 组件不引入全局 CSS；样式由 Tailwind 工具类表达，消费端负责引入 Tailwind 并扫描本目录源码。

## 目录结构

目录树、组件放置与文件命名约定见 [STRUCTURE.md](STRUCTURE.md)。

## UI 设计规范

### 颜色

| 用途 | 浅色 | 深色（`dark:`） |
| --- | --- | --- |
| 页面背景 | `from-sky-50 via-white to-slate-100` | `from-slate-900 via-slate-950 to-black` |
| 卡片背景 | `bg-white/90` | `bg-slate-900/80` |
| 主文本 | `text-slate-900` | `text-slate-100` |
| 次文本 | `text-slate-500` | `text-slate-400` |
| 标签/说明 | `text-slate-600` | `text-slate-300` |
| 边框 | `border-slate-200` / `border-slate-300` | `border-white/10` / `border-white/15` |
| 主操作 | `from-sky-500 to-blue-600` | 同浅色（按钮不反转） |
| 聚焦 | `border-sky-500` + `ring-sky-500/30` | 同浅色 |
| 错误 | `text-red-600` / `bg-red-50` | `text-red-400` / `bg-red-500/10` |

- 主色只有一组（sky → blue 渐变），不要引入第二套品牌色。
- 中性色统一用 `slate`，不要混用 `gray` / `zinc`。
- 语义色只用于语义：错误用 `red`，成功/警告当前未定义，新增前先补规范。

### 间距与圆角

- 页面容器：`p-6`；卡片：`p-7`，内部 `gap-[18px]`。
- 字段组：`gap-2`；字段与按钮之间不额外插空元素，错误提示占一个 grid 行。
- 圆角：卡片 `rounded-2xl`，输入框/按钮 `rounded-xl`，提示块 `rounded-lg`，胶囊导航 `rounded-full`。
- 阴影：卡片 `shadow-2xl shadow-slate-900/10`，深色 `dark:shadow-black/50`。
- 宽度：表单卡片 `w-full max-w-sm`；不要写死像素宽度。

### 字体

| 元素 | 规格 |
| --- | --- |
| 标题 | `text-2xl tracking-tight`，`m-0` |
| 描述 | `text-sm` + 次文本色 |
| 字段标签 | `text-[13px]` |
| 输入框 | `text-[15px]` |
| 按钮 | `text-[15px] font-semibold` |
| 错误提示 | `text-[13px] font-medium` |
| 代码/ID | `text-[11px]` |

- 不引入自定义字体；使用系统字体栈（消费端 `font-family` 决定）。
- 中文与数字混排不要手动加 `letter-spacing`，标题仅允许 `tracking-tight`。

### 状态与交互

- 每个可交互元素必须有 `hover`、`focus-visible`（或 `focus:` + ring）、`disabled` 三种状态。
- 提交中：`disabled` + `cursor-progress`，容器加 `aria-busy`。
- 错误提示：`role="alert"` + `aria-live="assertive"`，位置在字段之后、主按钮之前。
- 过渡统一 `transition`（默认 150ms），不做长动画，不写 `animate-*` 循环动画。
- 响应式采用 mobile-first：默认单列，`md:` 起分栏。

### 可访问性

- 输入必须被 `<label>` 包裹并带可见文本，不使用 placeholder 代替标签。
- 图标按钮必须有 `aria-label`；装饰性元素加 `aria-hidden`。
- 导航当前项用 `aria-current`，折叠项用 `aria-expanded`。
- 文本与背景对比度不低于 4.5:1；错误色不得只靠颜色区分，必须同时有文案。

## CSS 样式规范（重点）

### 基本规则

1. **只使用 Tailwind CSS v4 工具类**。禁止 `<style>` 标签、`style={{...}}` 内联样式、组件级 `.css` 文件。
2. 禁止引入全局选择器（`body`、`*`）或覆盖 Tailwind 预置类；组件样式必须自包含。
3. 禁止 `!important`；需要覆盖时调整类顺序或使用修饰符。
4. 禁止在组件里 `import "xxx.css"`；CSS 入口只属于消费端（`web/src/styles.css`、`preview/styles.css`）。
5. Tailwind 只识别**完整字面量**类名：条件样式必须是完整字符串（`active ? "bg-blue-500" : "bg-transparent"`），禁止 `bg-${color}-500` 这类拼接。

### 类名书写顺序

同一元素的 `class` 按以下顺序书写，便于 review：

```text
布局(display/flex/grid/order) → 尺寸(w/h/max-*) → 间距(p/m/gap) → 边框与圆角
→ 背景/阴影/模糊 → 文本(字号/颜色/字重) → 状态(hover/focus/disabled/aria)
→ 深色(dark:) → 其他
```

示例：

```tsx
class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900
       outline-none transition placeholder:text-slate-400
       focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30
       disabled:opacity-60
       dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100"
```

### 任意值

- 优先使用标准刻度（`p-6`、`gap-2`、`text-sm`）。
- 仅当设计规格没有对应刻度时使用任意值，常见合法用法：`gap-[18px]`、`text-[13px]`、`text-[15px]`、`max-h-[45vh]`。
- 同一任意值至少出现两次时，考虑收敛为规范刻度或组件 token，不要到处复制。

### 深色模式

- 所有颜色类都必须同时给出浅色与 `dark:` 版本，不允许只写一种。
- 深色模式跟随系统（Tailwind 默认 `prefers-color-scheme`），不额外维护 `.dark` class 开关。
- 渐变背景在深色下整体换色，不叠加透明度补丁。

### 响应式

- 移动端优先：默认样式用于窄屏，`md:` 及以上覆盖。
- 断点只用 `md:`（768px）；需要更细粒度时先更新本规范。
- 侧边导航、面板滚动等布局类写在容器上，不在子元素重复。

### 预览样式

- `preview/` 是开发工具，允许独立 `styles.css`，但只允许 `@import "tailwindcss"` 与 `@source` 声明，不写自定义组件样式。
- 预览页面的导航、状态条同样使用工具类，不写内联样式。

## 组件 API 约定

- props 只描述展示与交互，不出现 `gateway`、`platform`、`session` 等上下文概念。
- 组件文案全部通过 `translate` 获取，不提供 `title` / `description` / `labels` / `messages` 等文案 props；语言用 `locale` 控制，校验用 `validate`，提交用 `onSubmit`。
- 错误信息以抛出 `Error` 的方式从 `onSubmit` 传出，组件只负责展示 `message`。
- 组件内部状态只包括输入值、pending、error；不缓存会话、不写 storage。
- 导出类型与组件放在同一个领域 `index.ts`，不要在组件文件里 re-export 别的领域。

## 国际化

- 默认语言为中文（`DEFAULT_LOCALE = "zh-CN"`），由 `@solid-primitives/i18n` 提供模板解析。
- 字典位于 `src/i18n/dictionaries.ts`，使用扁平点分 key（`login.title`、`login.errors.fallback`）；中文不维护字典，直接以 JSX 里的中文 fallback 为准；`enUS` 是 key 类型来源，新增语言用 `Record<MessageKey, string>` 强制同 key。
- 组件不硬编码可见文案：通过 `locale?: Locale` 选择语言，默认中文；标题、字段标签、按钮与默认提示全部在 JSX 中直接调用 `translate(locale, key, fallback?, params?)`，不额外封装 `title()` / `labels()` / `messages()` 之类的文案 helper，也不接受文案 props 覆盖。
- 新增文案时：在组件里写中文 fallback，并在 `enUS` 中补同 key 的英文；插值使用 `{{ name }}` 语法。
- 消费端可 `import { translate, DEFAULT_LOCALE, type Locale } from "@loong/ui/i18n"`，用 `translate(locale, key, fallback?, params?)` 取文案（例如校验错误）。取词必须提供中文兜底；当前语言缺 key 时回退默认语言，再缺才用 fallback，最后退化为 key。
- 新增语言：在 `Locale` 联合与 `LOCALES` 中登记，并在 `src/i18n/index.ts` 的 `dictionaries` 中注册一份同 key 字典；组件代码不需要改动。

## 验证

在仓库根目录执行：

```powershell
bun install
bun run typecheck                 # @loong/web + @loong/ui
bun run build:web                 # 生产构建
bun run --filter '@loong/ui' preview   # http://127.0.0.1:5174
```

- 组件改动至少保证 `typecheck` 通过；涉及样式的改动在预览里逐项检查四种状态（默认、hover/focus、pending、error）。
- 新增用例后确认：默认折叠、搜索可命中、hash 深链可打开、HMR 生效。
- 不在本目录引入测试框架；组件行为通过预览用例与 Web 端集成验证。
