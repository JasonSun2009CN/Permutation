# ADR-0003: SQLite with append-only migrations

- 状态：Accepted
- 日期：2026-10-31

## Context

提醒必须跨重启存活；会话、操作日志、设置、记忆也需要本地持久化。数据量小、单进程、读多写少。需要可测试、可迁移、易备份。

## Decision

- 使用 `better-sqlite3`（同步 API，主进程单线程，简单可靠）。
- 数据库文件：`app.getPath('userData')/permutation.db`。
- 启用 WAL、`foreign_keys=ON`、`busy_timeout=5000`。
- 迁移只追加，版本记录在 `schema_migrations`；已发布迁移不修改。
- 时间列统一 `TEXT` 存 UTC ISO（`Z`），便于排序与比较。
- 数据访问封装在 `packages/db` 的仓储类中；业务层不写 SQL。
- 测试使用 `:memory:`，每个测试独立数据库。

## Consequences

正面：

- 无需外部服务，离线可用，备份就是复制文件。
- 同步 API 避免异步竞态；调度器与工具共享同一连接。
- 迁移幂等可测试。

负面：

- 原生模块需要按 Electron ABI 重建（`npm run rebuild:native`）。
- 同步 API 会阻塞事件循环；当前数据量小可接受，大批量邮件同步时需要分页/worker。
- 内存测试与真实 WAL 行为略有差异。

## Alternatives

- `sql.js`（WASM）：无原生编译，但持久化需手动导出，崩溃风险高。
- `node:sqlite`：Electron 内置版本支持不稳定，暂不采用。
- JSON 文件：查询、索引、并发和迁移都更差。
- Postgres：本地优先场景过重。

## Revisit

- 若邮件同步/全文搜索导致主线程卡顿，考虑 worker 线程或分库。
- 若需要加密数据库，评估 SQLCipher；当前敏感密钥已单独加密。
