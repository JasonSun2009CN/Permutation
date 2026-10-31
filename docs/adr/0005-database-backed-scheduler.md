# ADR-0005: Database-backed scheduler with tick and catch-up

- 状态：Accepted
- 日期：2026-10-31

## Context

提醒必须在应用重启、休眠、崩溃后仍然可靠。`setTimeout` / 内存队列在重启后丢失；`node-schedule` 仍需自己处理持久化与补发。用户可能合盖数小时。

## Decision

- 提醒状态存 SQLite，调度器只做「查到期 → 标记 fired → 回调」。
- 每 15 秒 tick 一次；创建/修改/推迟后立即 `checkNow()`。
- 启动时 `catchUp()`：所有 `pending AND trigger_at <= now` 都立即触发，并标记 `missed: true`。
- `powerMonitor.resume` / `unlock-screen` 触发 `checkNow()`。
- 系统通知由主进程发出；应用内卡片始终同步显示。
- 单进程 `running` 标志避免 tick 重入；`onDue` 失败记录但不永久重试。
- 等待确认的提醒不会重复通知；状态进入 `fired` 后由用户完成/推迟/忽略。

## Consequences

正面：

- 重启/休眠后不丢提醒（会补发）。
- 调度逻辑纯 TS，可注入时钟，测试快。
- 不需要维护第二套任务队列。

负面：

- 到点误差最多约 15 秒。
- 应用未运行且关机时无法通知；只能下次启动补发。
- 若用户在通知出现后完全不操作，提醒保持 `fired`，不会无限轰炸。
- `onDue` 回调失败（如通知权限问题）不会自动重试，需日志排查。

## Alternatives

- `node-schedule`：仍要持久化；重启恢复需额外工作。
- 系统日历提醒兜底：阶段 2 可考虑把提醒写入日历，增加系统级兜底。
- 后台常驻 helper/launchd：阶段 6 评估开机自启与后台运行。

## Revisit

- 如果 15 秒误差不可接受，改成「计算下一次到期时间 + setTimeout」并在每次变更时重排；仍需 tick 作为兜底。
- 如果要做「连续拖延升级提醒」，引入 notification attempts 计数与策略表。
