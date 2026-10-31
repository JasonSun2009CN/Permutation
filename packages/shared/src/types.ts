export type ProviderProtocol = 'openai' | 'anthropic'

export interface ProviderConfig {
  protocol: ProviderProtocol
  baseUrl: string
  model: string
  temperature: number
  apiKey: string
}

/* -------------------------------------------------------------------------- */
/* LLM primitives                                                             */
/* -------------------------------------------------------------------------- */

export interface LLMToolCall {
  id: string
  name: string
  argumentsJson: string
}

export interface LLMToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type LLMRole = 'system' | 'user' | 'assistant' | 'tool'

export interface LLMMessage {
  role: LLMRole
  content: string
  toolCalls?: LLMToolCall[]
  toolCallId?: string
  toolName?: string
}

export interface LLMChatRequest {
  messages: LLMMessage[]
  tools: LLMToolSpec[]
  signal?: AbortSignal
}

export interface LLMChatResponse {
  text: string
  toolCalls: LLMToolCall[]
  stopReason?: string
}

export interface LLMProvider {
  readonly id: string
  chat(request: LLMChatRequest): Promise<LLMChatResponse>
  ping(model?: string): Promise<{ text: string; latencyMs: number }>
}

export interface ToolExecutionOutcome {
  status: ToolCallStatus
  /** Structured payload returned to the model. */
  result: unknown
  /** Short human-readable description shown in the chat trace and action log. */
  summary: string
  durationMs: number
}

export interface ToolRuntime {
  specs(): LLMToolSpec[]
  describe(name: string, args: Record<string, unknown>): string
  requiresConfirmation(name: string, args: Record<string, unknown>): boolean
  execute(
    name: string,
    args: Record<string, unknown>,
    options: { confirmed: boolean | null; signal: AbortSignal; conversationId: string },
  ): Promise<ToolExecutionOutcome>
}

/* -------------------------------------------------------------------------- */
/* Reminders                                                                  */
/* -------------------------------------------------------------------------- */

export type ReminderStatus = 'pending' | 'fired' | 'completed' | 'dismissed' | 'cancelled'

export type ReminderSource = 'chat' | 'manual' | 'system'

export interface Reminder {
  id: string
  content: string
  /** UTC ISO 8601. The offset is normalised at the boundary. */
  triggerAt: string
  status: ReminderStatus
  source: ReminderSource
  conversationId: string | null
  firedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateReminderInput {
  content: string
  triggerAt: string
  source?: ReminderSource
  conversationId?: string | null
}

export interface UpdateReminderInput {
  content?: string
  triggerAt?: string
}

export interface ReminderFilter {
  status?: ReminderStatus | 'all' | 'open'
  from?: string
  to?: string
  limit?: number
}

/* -------------------------------------------------------------------------- */
/* Conversations                                                              */
/* -------------------------------------------------------------------------- */

export type ToolCallStatus = 'ok' | 'error' | 'denied'

export interface ToolTrace {
  callId: string
  name: string
  args: unknown
  status: ToolCallStatus
  summary: string
  durationMs?: number
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export type MessageRole = 'user' | 'assistant'

export interface StoredMessage {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  tools: ToolTrace[]
  createdAt: string
}

/* -------------------------------------------------------------------------- */
/* Action log                                                                 */
/* -------------------------------------------------------------------------- */

export type ActionSource = 'chat' | 'ui' | 'notification' | 'system'

export interface ActionLog {
  id: string
  createdAt: string
  toolName: string
  args: unknown
  result: unknown
  status: ToolCallStatus
  confirmed: boolean | null
  durationMs: number
  source: ActionSource
  conversationId: string | null
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export type LanguagePreference = 'system' | 'zh' | 'en'
export type ThemePreference = 'system' | 'light' | 'dark'

export interface AppSettings {
  protocol: ProviderProtocol
  baseUrl: string
  model: string
  temperature: number
  language: LanguagePreference
  theme: ThemePreference
  launchAtLogin: boolean
  notificationsEnabled: boolean
  notificationSound: boolean
  maxAgentSteps: number
  timezone: string
}

export interface SettingsView extends AppSettings {
  hasApiKey: boolean
}

export type SettingsPatch = Partial<AppSettings>

export interface ProviderTestInput {
  protocol?: ProviderProtocol
  baseUrl?: string
  model?: string
  apiKey?: string
}

export interface ProviderTestResult {
  ok: boolean
  latencyMs: number
  message: string
}

export interface AppInfo {
  version: string
  platform: string
  shortcut: string
  locale: string
  timezone: string
  dataDir: string
}

export interface BootstrapPayload {
  settings: SettingsView
  reminders: Reminder[]
  conversations: Conversation[]
  appInfo: AppInfo
}

/* -------------------------------------------------------------------------- */
/* Agent runtime                                                              */
/* -------------------------------------------------------------------------- */

export interface ConfirmationRequest {
  id: string
  runId: string
  toolName: string
  summary: string
  args: Record<string, unknown>
  risk: 'high'
  expiresAt: string
}

export interface ChatSendInput {
  text: string
  conversationId?: string | null
}

export interface ChatSendResult {
  runId: string
  conversationId: string
  userMessage: StoredMessage
}

export type AgentEvent =
  | { type: 'run_started'; runId: string; conversationId: string; userMessage: StoredMessage }
  | {
      type: 'tool_started'
      runId: string
      conversationId: string
      callId: string
      name: string
      args: unknown
    }
  | {
      type: 'tool_finished'
      runId: string
      conversationId: string
      callId: string
      name: string
      status: ToolCallStatus
      summary: string
      result?: unknown
      durationMs: number
    }
  | {
      type: 'confirmation_required'
      runId: string
      conversationId: string
      request: ConfirmationRequest
    }
  | {
      type: 'confirmation_resolved'
      runId: string
      conversationId: string
      confirmationId: string
      approved: boolean
    }
  | {
      type: 'assistant_message'
      runId: string
      conversationId: string
      message: StoredMessage
    }
  | { type: 'run_finished'; runId: string; conversationId: string }
  | {
      type: 'run_failed'
      runId: string
      conversationId: string
      message: string
      code: string
    }
  | { type: 'reminder_fired'; reminders: Reminder[]; missed: boolean }
  | { type: 'reminders_changed' }
  | { type: 'conversations_changed' }
  | { type: 'settings_changed'; settings: SettingsView }
  | { type: 'new_reminder' }
  | { type: 'focus_composer' }
  | { type: 'open_settings' }
  | { type: 'toast'; tone: 'info' | 'success' | 'error'; message: string }
