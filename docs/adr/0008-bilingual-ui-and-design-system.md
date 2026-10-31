# ADR-0008: Bilingual UI, system theme, and a restrained design system

- 状态：Accepted
- 日期：2026-10-31

## Context

用户要求中英双语界面、跟随系统深浅色。第一阶段需要一个安静、可信、适合长时间使用的桌面界面，而不是通用后台模板。设计参考了 `ui-ux-pro-max` 的检索结果。

## Decision

- UI 语言：`system` / `zh` / `en`，选择持久化；系统模式读取 `app.getLocale()`。
- 所有用户可见文案走 `lib/i18n.ts` 字典，禁止组件内硬编码。
- 主题：`system` / `light` / `dark`；主进程 `nativeTheme.themeSource` + renderer class 双重应用。
- 设计 token 集中在 `styles.css`，通过 Tailwind 4 `@theme inline` 暴露语义色。
- 字体使用系统 UI 字体与 SF Mono，**不采用**检索建议的 Caveat/Quicksand（中英混排与可读性不适合）。
- 主色 teal（#0F766E / #2DD4BF），warm 表示逾期/待确认，danger 仅用于破坏性动作。
- 图标统一 Lucide；禁止 emoji 图标。
- 页面结构：252px 侧栏 + 顶部拖拽条 + 单列内容；聊天/设置最大宽度 768px。
- 动效 150–220ms，尊重 `prefers-reduced-motion`。

## Consequences

正面：

- 中英文共享同一布局，不需要两套样式。
- 语义 token 让深浅色一致，后续换肤成本低。
- 界面安静，适合生产力场景。

负面：

- 所有文案必须同步维护两种语言，遗漏会回落到英文。
- 自定义 token 增多后需要约束，避免散落 hex。
- 系统字体在不同平台略有差异。

## Alternatives

- 引入完整组件库（shadcn/Radix）：组件多，但会带来不同视觉语言；当前自己实现少量原语更可控。
- 双主题两套 CSS：维护成本高。
- 只做中文：与用户选择冲突。

## Revisit

- 若组件增长到 30+，评估引入 Radix 作为无样式行为层。
- 若增加第三种语言，把字典抽成独立包并加入 i18n 检查测试。
