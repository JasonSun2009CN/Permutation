# ADR-0006: Connector strategy — notifications now, IMAP mail, EventKit calendar

- 状态：Accepted
- 日期：2026-10-31

## Context

用户当前使用网易邮箱与 Apple Calendar，但未来用户可能用 Gmail、Outlook。需要在不牺牲当前体验的前提下，选择一条平台差异最小、可逐步扩展的连接器路线。

另外，macOS 不向第三方开放通知中心的读取 API。抓取横幅依赖辅助功能权限与 UI 结构，系统升级容易失效。

## Decision

### 通知

- 不读取通知中心作为主数据源。
- 助理自己的「收件箱」由邮件、日历、提醒事项源头聚合（阶段 4）。
- 系统通知只用于**发出**提醒，按钮 + 应用内卡片兜底。
- 未签名/权限受限的开发构建若被 macOS 拒绝 Electron 通知，自动降级为 AppleScript `display notification`（无按钮）；应用内卡片保留完整操作。
- 通知横幅抓取只作为默认关闭的实验开关（P2）。

### 邮件

- **IMAP 优先**：一个连接器覆盖网易、QQ、Gmail、Outlook（应用专用密码/授权码）。
- 后续可为 Gmail / Microsoft Graph 增加 OAuth 快速路径。
- 只读同步、增量拉取、分页；模型只接收摘要/必要片段。

### 日历

- macOS 首选 **EventKit**（通过 Swift 命令行 helper，由主进程子进程调用），覆盖 Apple Calendar/iCloud。
- 阶段 2 先做最小读取脚本，再扩展读写、冲突检测、空闲时段。
- 用户在考虑「内置日历 + 桌面组件」是否更方便。这是一个**开放产品问题**，不在阶段 1/2 默认实现；若要内置，需要新增 `calendar_events` 表并明确与 Apple Calendar 的同步方向。

## Consequences

正面：

- 不依赖脆弱的 UI 抓取。
- 邮件方案覆盖国内外主流邮箱，无需为每家申请 OAuth 应用。
- EventKit 提供系统级日历读写与权限模型。

负面：

- IMAP 需要处理各家授权码、文件夹命名、TLS、IDLE/轮询差异。
- EventKit 仅 macOS；Windows 未来需 Graph/Outlook COM。
- 内置日历会带来双数据源同步问题，需单独 ADR。

## Alternatives

- 直接读通知中心：不可靠，已拒绝。
- Gmail API + Graph 双 OAuth：体验好，但开发者需要维护两套 OAuth 应用与审核。
- 纯内置日历：可控，但用户现有 Apple Calendar 数据迁移/同步成本高。

## Revisit

- 阶段 2 结束前，基于 EventKit 验证结果决定「内置日历」是否值得做。
- 阶段 4 前确认 IMAP 供应商兼容矩阵与凭据存储方式。
