# ADR-0009: Time representation and relative-time handling

- 状态：Accepted
- 日期：2026-10-31

## Context

「十分钟后」「明天下午三点」是核心输入。时区、夏令时、跨日、12/24 小时制、模型幻觉都可能导致错误提醒。直接存本地时间字符串或让模型自由计算都不可靠。

## Decision

- 数据库存 UTC ISO（`Z`），比较和排序基于字符串/毫秒。
- 边界校验：任何外部时间必须能匹配 `Z` 或 `±HH:MM`，否则拒绝（`isZonedIso`）。
- 模型在解释相对时间前必须调用 `get_current_time`；系统提示词同时注入当前时间、时区、星期、locale。
- 工具只接受带偏移的 ISO；`create_reminder` 拒绝过去时间（30 秒容差），要求模型反问。
- 展示使用 `Intl.DateTimeFormat`，locale 由语言设置决定；同时展示绝对时间与相对时间。
- 系统时区是唯一事实来源（设置中暂不提供手动时区）。
- 摘要/提示词中的时间使用 `toOffsetIso` 生成带偏移格式。

## Consequences

正面：

- 跨时区/夏令时行为由 Date/Intl 处理，不手写偏移。
- 模型即使算错，工具层也会拒绝无偏移或过去时间。
- 测试可固定时区（Asia/Shanghai / America/New_York）验证。

负面：

- 模型需要多一次工具调用（成本略增）。
- 12 小时制 locale 显示 AM/PM，时间列需要更宽。
- 用户手动改系统时区后，已有提醒按 UTC 保持原瞬间（符合预期）。

## Alternatives

- 存本地时间字符串：跨时区/夏令时容易错。
- 让模型直接输出 UTC：模型更难算对本地时间。
- 使用 Temporal API：Node/Chromium 支持未完全统一，暂不依赖。

## Revisit

- 若支持用户自定义时区/旅行模式，增加 `timezone` 设置并明确「已有提醒是否随行」。
- 若需要重复规则，使用 RRULE 并单独 ADR 处理 DST。
