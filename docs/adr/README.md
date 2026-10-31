# Architecture Decision Records

| ADR                                            | 决策                                               | 状态     |
| ---------------------------------------------- | -------------------------------------------------- | -------- |
| [0001](0001-desktop-stack-and-monorepo.md)     | Electron + React + Vite + npm workspaces           | Accepted |
| [0002](0002-llm-provider-abstraction.md)       | 双协议 Provider + 非流式 Agent 循环                | Accepted |
| [0003](0003-sqlite-and-migrations.md)          | better-sqlite3 + 只追加迁移 + UTC ISO              | Accepted |
| [0004](0004-fail-closed-confirmations.md)      | 高风险工具失败关闭确认                             | Accepted |
| [0005](0005-database-backed-scheduler.md)      | 15s tick + 启动补发的自建调度器                    | Accepted |
| [0006](0006-connector-strategy.md)             | 通知兜底；IMAP 邮件；EventKit 日历；暂不读通知中心 | Accepted |
| [0007](0007-secrets-in-os-keychain.md)         | safeStorage 加密 API Key                           | Accepted |
| [0008](0008-bilingual-ui-and-design-system.md) | 中英双语 + 系统主题 + 自定义 token                 | Accepted |
| [0009](0009-time-representation.md)            | 存储 UTC、边界强制偏移、模型必取当前时间           | Accepted |
| [0010](0010-tray-resident-lifecycle.md)        | 托盘常驻 + 关闭隐藏 + 单实例 + 全局快捷键          | Accepted |

新增 ADR 时：

1. 文件名 `NNNN-kebab-case.md`。
2. 状态使用 `Proposed` / `Accepted` / `Superseded` / `Deprecated`。
3. 至少包含 Context / Decision / Consequences / Alternatives。
4. 在上表补一行。
