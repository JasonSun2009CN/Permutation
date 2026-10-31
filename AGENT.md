# AGENT.md

本文件是给后续开发 Agent（以及人类协作者）的操作手册。开始任何改动前，请先读：

1. [README](README.md)
2. [架构说明](docs/architecture.md)
3. [路线图](docs/roadmap.md)
4. 相关 [ADR](docs/adr/README.md)
5. [阶段 1 验收](docs/acceptance-phase-1.md)

## 项目是什么

Permutation 是一个 macOS 优先的本地桌面 AI 助理。阶段 1 的产品闭环是：自然语言 → Agent tool call → SQLite 提醒 → 调度器 → 系统通知 / 应用内卡片 → 完成 / 推迟 / 忽略。

当前**不是**通用日历或邮件客户端。不要把后续阶段的能力提前塞进来；严格按 [路线图](docs/roadmap.md) 的阶段验收推进。

## 命令

```bash
npm install            # 下载 Electron + 编译 better-sqlite3（postinstall）
npm run dev            # electron-vite 开发模式
npm run build          # 构建到 apps/desktop/out
npm run typecheck      # tsc node + web
npm test               # vitest
npm run lint
npm run format
npm run rebuild:native # ABI 变化后重新编译 better-sqlite3
```

任何提交前至少运行：`npm run typecheck && npm test && npm run lint`。

Electron 下载失败时：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run setup
```

## 仓库地图

| 位置                        | 规则                                                       |
| --------------------------- | ---------------------------------------------------------- |
| `apps/desktop/src/main`     | 唯一可以访问 Electron、文件系统、钥匙串、系统通知的地方    |
| `apps/desktop/src/preload`  | 只负责 `contextBridge` 暴露类型化 IPC，禁止业务逻辑        |
| `apps/desktop/src/renderer` | 纯 UI；只能通过 `window.permutation` 访问主进程能力        |
| `packages/agent`            | Provider、提示词、Agent 循环；不直接访问数据库或 Electron  |
| `packages/tools`            | 工具 Schema + 执行 + 确认策略；通过 `ToolContext` 注入服务 |
| `packages/db`               | SQLite schema、迁移、仓储；不依赖 Electron                 |
| `packages/scheduler`        | 纯 TS 调度逻辑；时间可注入，便于测试                       |
| `packages/shared`           | 类型、时间工具、IPC 契约；不得依赖 Node/Electron           |
| `packages/connectors`       | 外部系统边界；阶段 2/4 才实现日历与邮件                    |
| `docs/`                     | 设计决策与验收记录；重要决定必须落 ADR                     |

## 不可破坏的约定

### 1. 时间必须带时区

- 数据库统一存储 UTC ISO（`Z`）。
- 任何来自模型或 UI 的时间字符串必须带 `Z` 或 `±HH:MM`，由 `isZonedIso` / `normalizeZonedIso` 校验。
- 模型在解释「十分钟后」「明天下午三点」前必须调用 `get_current_time`。
- 禁止使用 `Date.parse('2026-10-31 15:00')` 这类无时区解析。
- 展示层使用 `Intl.DateTimeFormat`，locale 由语言设置决定。

### 2. 高风险操作必须失败关闭

- 需要确认的工具在 `ToolDefinition.requiresConfirmation` 中标记。
- 当前为 `cancel_reminder`；阶段 2 的修改/删除日历事件、发邮件也必须标记。
- 确认状态保存在主进程内存中；超时（5 分钟）、用户取消、应用重启一律视为拒绝。
- 不允许通过 IPC、UI 或日志绕过确认直接调用高风险工具。

### 3. 不允许假装成功

- 工具抛错必须作为 `{ ok: false, error }` 回传给模型，并写入 `action_logs`。
- 模型回复不能声称工具成功，除非工具结果确实成功。
- 错误信息可以脱敏，但不能用「已完成」掩盖失败。

### 4. 系统能力只在主进程 / connectors

- 渲染进程 `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`。
- 新增系统能力时：`packages/connectors` 定义接口 → 主进程实现 → IPC → preload → renderer。
- 不要从 renderer 直接 `fetch` 模型 API；请求必须在主进程发出。

### 5. 密钥只走安全存储

- API Key 只能通过 `SettingsService.setApiKey` 写入 `safeStorage` 加密后的 blob。
- 不允许明文写入 SQLite、日志、配置文件或 renderer state。
- `PERMUTATION_API_KEY` 仅限未打包开发模式；打包版本必须忽略。

### 6. 数据库迁移只前进

- 修改 schema 时在 `packages/db/src/migrations.ts` 追加新版本，不修改已发布迁移。
- 新表/索引必须有对应测试（至少覆盖迁移与主要仓储行为）。
- 时间列使用 `TEXT` 存 UTC ISO，便于排序。

### 7. 工具是唯一的动作入口

- 所有 Agent 动作必须有工具定义、JSON Schema、执行实现、确认标记、单元测试和示例（见 `docs/tools.md`）。
- 工具结果要适中：不要向模型回传整篇邮件或超大 JSON。
- 工具名、参数语义变更属于破坏性变更，需同步文档与提示词版本。

### 8. 提示词版本化

- 系统提示词在 `packages/agent/src/prompts/system.ts`，版本号写入 `SYSTEM_PROMPT_VERSION`。
- 改动提示词必须更新 `docs/prompts.md` 的变更记录与回归用例。
- 不要在多个文件散落提示词片段。

### 9. 双语与主题

- 所有用户可见字符串必须同时提供 `zh` 与 `en`，禁止硬编码中文/英文到组件。
- 设计 token 在 `apps/desktop/src/renderer/src/styles.css`；不要引入第二套颜色体系。
- 图标统一 Lucide；不要用 emoji 当图标。

## 开发流程

1. 确认当前阶段与验收标准（roadmap）。
2. 若涉及架构取舍，先写 ADR（状态 `Proposed`），再实现。
3. 先写/更新测试，再改实现。
4. 更新文档：README 能力表、tools、prompts、roadmap、验收记录。
5. 运行 typecheck / test / lint / format。
6. 在提交说明中写清「为什么」，不是只写「改了什么」。

## 阶段闸门

- 阶段验收不通过，不进入下一阶段。
- 每个阶段结束必须留下 `docs/acceptance-phase-N.md`。
- 阶段 1 明确未做：重复提醒、日历、邮件、语音、记忆、每日简报、打包签名。

## 调试与 QA

- 数据库：`~/Library/Application Support/Permutation/permutation.db`。
- 视觉截图（无需屏幕录制权限）：

  ```bash
  PERMUTATION_CAPTURE_PATH=/tmp/chat.png npm run dev
  PERMUTATION_CAPTURE_PATH=/tmp/today.png PERMUTATION_CAPTURE_PAGE=today npm run dev
  PERMUTATION_CAPTURE_CONVERSATION=1 ...   # 打开第一条会话
  PERMUTATION_CAPTURE_POPUP=1 ...          # 注入提醒卡片
  PERMUTATION_CAPTURE_CONFIRM=1 ...        # 注入确认卡片
  PERMUTATION_CAPTURE_CHAT='十分钟后提醒我喝水' ... # 自动发送消息
  ```

- 临时数据库：`PERMUTATION_USER_DATA_DIR=/tmp/permutation-qa`
- 演示数据：`npx tsx scripts/seed-demo.ts /tmp/permutation-qa/permutation.db`
- 本地 mock 模型：`node scripts/mock-llm.mjs 8787`，设置 base URL 为 `http://127.0.0.1:8787/v1`。

## 常见坑

- **Electron 未安装**：Electron 45 移除了 postinstall，必须运行 `install-electron`；仓库的 postinstall 已包含。
- **better-sqlite3 ABI 不匹配**：升级 Electron 后运行 `npm run rebuild:native`。
- **端口 5173 被占用**：electron-vite 会自动换端口，不影响功能。
- **通知按钮看不见**：macOS 需要展开通知；应用内卡片是兜底，不要删。
- **系统通知被拒**：未签名的开发构建在某些 macOS 环境会返回 `UNErrorDomain error 1`；应用会自动用 `osascript display notification` 兜底（无按钮），应用内卡片仍可操作。打包签名后优先走 Electron 原生通知。
- **系统通知权限**：首次可能被系统拒绝，需在系统设置中允许。
- **CSP**：renderer 的 `index.html` 有 CSP；新增外部资源前先确认是否真的需要。
- **打包**：`electron-builder.yml` 只是预留配置，未签名/公证，不要把 `npm run dist` 当作已验证交付。

## 完成定义（DoD）

- [ ] 新行为有测试，旧测试仍通过
- [ ] `npm run typecheck`、`npm test`、`npm run lint` 通过
- [ ] 高风险动作失败关闭
- [ ] 时间带时区偏移
- [ ] 中英文文案齐全
- [ ] 操作写入日志
- [ ] 文档 / ADR / 验收记录已更新
