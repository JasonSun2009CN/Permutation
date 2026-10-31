# ADR-0007: Encrypt API keys with the OS keychain

- 状态：Accepted
- 日期：2026-10-31

## Context

用户需要填写模型 API Key。明文存 SQLite、配置文件或前端状态都会造成泄露风险。产品原则要求「API Key 本地加密保存（使用系统钥匙串）」。

## Decision

- 使用 Electron `safeStorage.encryptString` / `decryptString`。
- 密文（Buffer）存入 `secrets` 表，key 为 `llm_api_key`。
- Renderer 永远只拿到 `hasApiKey: boolean`；明文只在主进程内存中短暂存在。
- 系统钥匙串不可用时不退化为明文，直接报错并提示用户。
- 移除密钥会删除密文；UI 确认后执行。
- 未打包开发模式允许 `PERMUTATION_API_KEY` 环境变量，仅供本地/CI 冒烟；打包版本忽略。
- 不把 Key 写入日志、错误消息或 action_logs。

## Consequences

正面：

- 静态磁盘上无明文密钥。
- 与 macOS 钥匙串权限模型一致。
- 用户可随时移除。

负面：

- 首次保存可能触发系统钥匙串授权弹窗（正常）。
- 无法在无 GUI/无钥匙串的 CI 中测试真实加密路径；使用环境变量绕过。
- 迁移到其他机器时密钥不会随 DB 复制（安全特性，但用户需重新填写）。

## Alternatives

- `keytar`：额外原生依赖，Electron 已内置 safeStorage。
- 明文 + 文件权限：不满足产品要求。
- 每次启动让用户输入：体验差。

## Revisit

- 若支持 Windows/Linux，确认 safeStorage 后端（DPAPI/libsecret）可用性并写测试。
- 若未来支持多模型多 Key，`secrets` 表按 provider 维度扩展。
