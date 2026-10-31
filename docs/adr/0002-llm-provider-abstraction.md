# ADR-0002: LLM Provider abstraction with dual protocols

- 状态：Accepted
- 日期：2026-10-31

## Context

产品需要让用户自己填写 API Key、模型、Base URL，可能使用 Claude 原生 API、DeepSeek、OpenRouter、公司中转站等。不同服务的 tool use 报文格式不同：OpenAI 是 `tools` + `tool_calls` + `role: tool`，Anthropic 是 `tools` + `tool_use` / `tool_result` content blocks。

## Decision

- 定义统一 `LLMProvider` 接口：`chat(request)` + `ping()`。
- 提供两个适配器：
  - `OpenAICompatibleProvider`（`/chat/completions`）
  - `AnthropicProvider`（`/v1/messages`）
- 设置页选择协议，Base URL/模型/Key 均可配置。
- 第一阶段**非流式**：一次完整响应后广播消息；工具执行过程通过事件实时展示。
- 最大 120 秒超时；用户取消通过 `AbortController` 传播。
- 工具调用循环最多 `maxAgentSteps`（默认 8）。
- Provider 错误统一转成 `run_failed` 事件，不把原始密钥/请求头写日志。

## Consequences

正面：

- 用户可以自由切换模型/中转站，不被单一厂商锁定。
- 工具 Schema 与 Agent 循环与协议解耦。
- 适配器可以独立做请求/响应测试。

负面：

- 两种协议的工具结果结构不同，Anthropic 需要合并连续 tool_result。
- Base URL 写法不统一，需要启发式解析（带不带 `/v1`）。
- 非流式导致最终回复等待时间较长；长回答没有打字机效果。
- 不同模型对「带偏移 ISO 时间」的遵循程度不一，工具层必须做硬校验。

## Alternatives

- 仅 OpenAI 兼容：实现最省事，但 Claude 原生用户吃亏。
- 仅 Anthropic：与用户「Base URL 可填」的需求冲突。
- 使用 LangChain 等框架：抽象层过重，工具/确认/日志仍要自己实现。

## Revisit

- 阶段 3 后评估流式：保留 tool call 增量解析与现有事件模型。
- 若增加本地模型（Ollama），增加一个 OpenAI 兼容 Base URL 即可，无需新协议。
- 若某家 API 的 tool schema 不兼容，优先在适配器内转换，不改工具定义。
