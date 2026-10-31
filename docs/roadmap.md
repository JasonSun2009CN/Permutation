# Roadmap

> 原则：每个阶段结束必须有可日常使用的版本和书面验收记录。验收不通过，不进入下一阶段。

## 已完成：阶段 0 · 准备与验证

- [x] macOS + Node 24 + Electron 45 + Vite 工程
- [x] npm workspaces monorepo、TypeScript 严格模式、ESLint、Prettier、CI
- [x] 模型 tool use 最小验证（`scripts/verify-llm.ts`，双协议适配器）
- [x] 系统通知最小验证（`scripts/verify-notification.cjs`）
- [x] 日历验证推迟到阶段 2（当前阶段不涉及）
- [x] 记录 ADR：技术栈、Provider、SQLite、确认、调度、连接器、密钥、时间、托盘

## 已完成：阶段 1 · 提醒 MVP

**目标：一句话创建提醒，到点可靠通知，重启不丢。**

- [x] 聊天窗口（会话列表、Markdown、工具执行轨迹、确认卡片、错误态）
- [x] 托盘常驻、关闭隐藏、单实例、`⌘⇧Space` 全局快捷键
- [x] Agent 主循环：最大步数、取消、工具错误回传、禁止假成功
- [x] 工具：`get_current_time`、`create_reminder`、`list_reminders`、`update_reminder`、`cancel_reminder`、`complete_reminder`、`snooze_reminder`、`send_notification`
- [x] 取消提醒前确认（5 分钟超时、失败关闭、操作日志）
- [x] SQLite：提醒、会话、消息、操作日志、设置、密钥密文、schema 迁移
- [x] 调度器：15 秒 tick、启动补发、休眠唤醒检查、推迟后重新调度
- [x] 系统通知 + 应用内卡片：完成 / 推迟 10 分钟 / 忽略
- [x] 设置页：双协议、Base URL、模型、API Key（钥匙串）、语言、主题、通知、声音、Agent 步数、数据目录
- [x] 今日视图、提醒列表（筛选/编辑/取消/完成/推迟）、动态日志、中英双语、深浅色
- [x] 自动化测试（35 项）、mock LLM 端到端冒烟测试、视觉 QA 截图钩子
- [x] 验收记录：[docs/acceptance-phase-1.md](acceptance-phase-1.md)

**明确未做（不要误认为已完成）**：重复提醒、日历、邮件、语音、记忆、每日简报、开机自启的真实验证、dmg 签名与公证。

## 下一步：阶段 2 · 日历接入（第 4–5 周）

前置决策（已与用户确认方向，细节待定）：

- 日历首选 **Apple Calendar / EventKit**（macOS 原生，用户当前使用）。
- 用户在考虑「应用内置日历 + 桌面组件」是否更方便；这是一条产品分支，**尚未决定**。阶段 2 先评估 EventKit 双向同步，再决定是否需要内置日历，见 [ADR-0006](adr/0006-connector-strategy.md)。

任务：

- [ ] 最小验证：Swift 命令行 helper 通过 EventKit 读取今天日程（先脚本，后集成）
- [ ] `packages/connectors/calendar` 接口：list / create / update / delete / free-busy
- [ ] 工具：`list_events`、`create_event`、`update_event`（确认）、`delete_event`（确认）、`find_free_slots`
- [ ] 创建前冲突检测
- [ ] 今日视图展示真实日程；空态与权限引导
- [ ] EventKit 权限被拒绝时的降级说明（不阻塞提醒）
- [ ] 单元测试：冲突检测、空闲时段算法；集成测试：测试日历账号/本地日历

验收：

- [ ] 问「我明天有什么安排」得到准确列表
- [ ] 创建、修改、删除事件可用；删除/修改必须确认
- [ ] 权限拒绝时不崩溃、不静默失败

## 阶段 3 · 待办与自动排期（第 6–7 周）

- [ ] 批量待办解析（标题、预估时长、截止、优先级）
- [ ] `add_tasks`、`schedule_tasks`、`commit_schedule`
- [ ] 排期草稿先展示、确认后写日历 + 建提醒
- [ ] 未完成自动重排
- [ ] 每日早间简报（主动触发 Agent）
- [ ] 晚间复盘（P2）

验收：一次丢入 5 件待办 → 合理草稿 → 确认后日历/提醒正确；故意不完成 → 自动重排。

## 阶段 4 · 邮件与通知（第 8–9 周）

邮件策略：**IMAP 优先**，兼容网易邮箱、QQ、Gmail、Outlook，无需为每家做 OAuth；后续可为 Gmail/Graph 增加 OAuth 快速路径。不读取系统通知中心，改为聚合邮件/日历/提醒源头。

- [ ] IMAP 连接器（授权码、TLS、只读同步、增量拉取）
- [ ] `list_emails`、`read_email`、`summarize_emails`
- [ ] 需要回复/有截止时间的邮件转待办（确认后）
- [ ] `draft_email`、`send_email`（发送必须确认）
- [ ] 聚合「收件箱」视图
- [ ] 通知中心横幅抓取仅实验开关，默认关闭（P2）

验收：总结今天未读邮件；把带截止时间的邮件转成待办；发送前有确认。

## 阶段 5 · 语音与记忆（第 10–11 周）

- [ ] 语音输入（方案待定：Whisper API / 本地 whisper.cpp）
- [ ] 语音播报提醒（系统 TTS）
- [ ] 记忆模块与 `save_memory` / `recall_memory` / `forget_memory`
- [ ] 记忆管理界面（查看/删除）
- [ ] 作息与偏好用于排期

验收：按住快捷键说话创建提醒；记住作息并用于排期。

## 阶段 6 · 打磨与发布（第 12 周）

- [ ] 开机自启真实可用（打包验证）
- [ ] 权限引导、设置完善、数据导出/一键清除
- [ ] 图标、签名、公证、dmg、自动更新
- [ ] 稳定性：连续运行一周、无崩溃、无漏提醒
- [ ] 作者本人日常使用一周并修复问题

## 待确认问题

1. 内置日历 vs Apple Calendar 单向/双向同步？（阶段 2 前决定）
2. 语音识别：云端 API 还是本地模型？（阶段 5 前决定）
3. 邮件内容发送给模型 API 的默认策略与脱敏范围。
4. 提醒语气与强度：温和 / 严格 / 可调。
5. Windows 是否进入第二阶段支持范围。
