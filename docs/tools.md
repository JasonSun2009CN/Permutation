# 工具清单（阶段 1）

所有 Agent 动作都以工具形式暴露。工具定义位于 `packages/tools/src/*.ts`，统一注册在 `defaultTools`。

约定：

- 时间参数必须是带偏移的 ISO 8601（`Z` 或 `±HH:MM`）。
- 相对时间必须先调用 `get_current_time`。
- 所有执行都会写入 `action_logs`。
- 高风险工具在 `requiresConfirmation: true` 时暂停，等待用户确认；拒绝/超时/重启都视为不执行。
- 失败返回 `{ ok: false, error }`，由模型决定补救或如实告知。

## 工具总览

| 工具                | 用途                  | 需确认 | 主要参数                    |
| ------------------- | --------------------- | ------ | --------------------------- |
| `get_current_time`  | 当前时间、时区、星期  | 否     | —                           |
| `create_reminder`   | 创建一次性提醒        | 否     | content, triggerAt          |
| `list_reminders`    | 查询提醒              | 否     | status?, from?, to?, limit? |
| `update_reminder`   | 修改内容/时间         | 否     | id, content?, triggerAt?    |
| `cancel_reminder`   | 取消提醒              | **是** | id                          |
| `complete_reminder` | 标记完成              | 否     | id                          |
| `snooze_reminder`   | 从当前时间推迟 N 分钟 | 否     | id, minutes?                |
| `send_notification` | 立即发系统通知        | 否     | title, body                 |

## get_current_time

返回：

```json
{
  "ok": true,
  "iso": "2026-10-31T14:26:00+08:00",
  "epochMs": 1793427960000,
  "timeZone": "Asia/Shanghai",
  "weekday": "Saturday",
  "locale": "zh-CN"
}
```

系统提示词要求模型在解释任何相对时间前调用它。

## create_reminder

```json
{
  "content": "喝水",
  "triggerAt": "2026-10-31T14:36:00+08:00"
}
```

- `content`：1–500 字符。
- `triggerAt`：必须带偏移。若早于当前时间 30 秒以上，工具拒绝并提示模型询问用户。
- 返回 `{ ok, reminder }`，其中 `reminder` 包含 id / content / triggerAt / status。

示例对话：

```text
用户：十分钟后提醒我喝水
模型：get_current_time → 2026-10-31T14:26:00+08:00
模型：create_reminder { content: "喝水", triggerAt: "2026-10-31T14:36:00+08:00" }
助手：已为你安排 14:36 的喝水提醒。
```

## list_reminders

```json
{
  "status": "open",
  "from": "2026-10-31T00:00:00+08:00",
  "to": "2026-11-01T00:00:00+08:00",
  "limit": 20
}
```

- `status`：`open`（pending + fired）、`pending`、`fired`、`completed`、`dismissed`、`cancelled`、`all`，默认 `open`。
- 默认最多 20 条，最大 100。
- 返回 `{ ok, count, reminders[] }`，按 triggerAt 升序。

## update_reminder

```json
{
  "id": "rem_…",
  "triggerAt": "2026-11-01T10:00:00+08:00"
}
```

- `content` 与 `triggerAt` 至少提供一个。
- 已取消/已完成的提醒不可修改。
- 修改已 fired 的提醒会重置为 pending。

## cancel_reminder（需确认）

```json
{ "id": "rem_…" }
```

- 确认卡片展示提醒内容与时间。
- 用户拒绝时返回 `status: denied`，提醒保持原状态。
- 记录 `confirmed: false` 的日志。

## complete_reminder

```json
{ "id": "rem_…" }
```

用于「我已经做了」，区别于取消。已 fired 的提醒完成后从待处理中移除。

## snooze_reminder

```json
{ "id": "rem_…", "minutes": 10 }
```

- 从当前时间起算，范围 1–1440 分钟，默认 10。
- 置为 pending、清空 firedAt，并由调度器重新检查。

## send_notification

```json
{ "title": "现在", "body": "站起来活动一下" }
```

用于用户明确要求「现在发个通知」；定时提醒请用 `create_reminder`。

## 工具返回约定

成功：

```json
{
  "ok": true,
  "reminder": { "id": "rem_…", "content": "喝水", "triggerAt": "…Z", "status": "pending" }
}
```

失败：

```json
{
  "ok": false,
  "error": "Invalid tool arguments.",
  "details": [
    { "path": "triggerAt", "message": "triggerAt must be ISO 8601 with an explicit offset" }
  ],
  "hint": "Use ISO 8601 timestamps with an explicit timezone offset. Call get_current_time before relative times."
}
```

## 工具摘要

每个工具执行后生成一条面向用户/模型的 `summary`，例如：

- `已创建提醒“喝水”，时间 10月31日 14:36。`
- `已取消提醒“交报告”。`
- `已将提醒“喝水”推迟到 10月31日 14:46。`

摘要会进入下一次上下文（`[Previous actions: …]`），帮助模型处理「把刚才那个改到明天」类请求。

## 后续阶段计划中的工具

| 阶段 | 工具                                                                             |
| ---- | -------------------------------------------------------------------------------- |
| 2    | `list_events`, `create_event`, `update_event`, `delete_event`, `find_free_slots` |
| 3    | `add_tasks`, `schedule_tasks`, `commit_schedule`                                 |
| 4    | `list_emails`, `read_email`, `summarize_emails`, `draft_email`, `send_email`     |
| 5    | `save_memory`, `recall_memory`, `forget_memory`                                  |

这些工具尚未实现，不要在当前版本提示模型中调用。
