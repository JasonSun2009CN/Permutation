# ADR-0001: Electron + React + Vite + npm workspaces

- 状态：Accepted
- 日期：2026-10-31

## Context

需要做一个 macOS 优先、能访问系统通知、托盘、钥匙串并常驻运行的桌面个人助理。第一阶段要求快速验证「自然语言 → 提醒 → 通知」。未来还要接日历、邮件、语音。

候选：

1. Electron + React
2. Tauri + React
3. 原生 SwiftUI
4. Web app + 浏览器通知

## Decision

- 桌面壳：Electron 45（Node 24、Chromium）。
- 前端：React 19 + TypeScript + Vite（electron-vite）+ Tailwind CSS 4 + Zustand。
- 仓库：npm workspaces monorepo，`apps/desktop` + `packages/*`。
- 包以源码形式通过 Vite alias 引用，不单独构建 dist。
- 主进程只负责系统能力与编排；renderer 运行在 `sandbox` + `contextIsolation`。
- 后续 Windows 支持沿用同一 main/renderer 分层，只在 connectors 做平台分支。

## Consequences

正面：

- 系统通知、托盘、全局快捷键、钥匙串、SQLite 原生模块都有成熟方案。
- React 生态便于做聊天、时间线和设置页。
- monorepo 让 Agent/Tools/Scheduler 可独立测试，后续日历/邮件不会污染主进程。

负面：

- 原生模块 `better-sqlite3` 需要按 Electron ABI 重新编译。
- 包体积明显大于 Tauri/原生。
- Electron 45 的安装方式变化（无 postinstall）需要显式 `install-electron`。
- 需要自己维护安全的 IPC 边界。

## Alternatives

- **Tauri**：体积小，但 macOS 通知按钮、EventKit、IMAP 的生态和调试成本更高；团队更熟悉 Node。
- **SwiftUI 原生**：体验最好，但跨平台与模型工具循环的迭代速度不如 Node；阶段 1 先验证产品价值。
- **Web app**：无法可靠地托盘常驻、全局快捷键、系统通知按钮。

## Revisit

- 若安装包体积/内存成为核心问题，评估 Tauri。
- 若 Windows 需求变强，先确认通知与日历连接器方案，再决定是否保留单一 Electron 代码库。
