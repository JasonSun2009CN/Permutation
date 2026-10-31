import type {
  ActionLog,
  AgentEvent,
  BootstrapPayload,
  ChatSendInput,
  ChatSendResult,
  Conversation,
  CreateReminderInput,
  ProviderTestInput,
  ProviderTestResult,
  Reminder,
  ReminderFilter,
  SettingsPatch,
  SettingsView,
  StoredMessage,
  UpdateReminderInput,
} from './types'

export interface ChatApi {
  send(input: ChatSendInput): Promise<ChatSendResult>
  cancel(runId: string): Promise<void>
  listConversations(): Promise<Conversation[]>
  getMessages(conversationId: string): Promise<StoredMessage[]>
}

export interface ReminderApi {
  list(filter?: ReminderFilter): Promise<Reminder[]>
  create(input: CreateReminderInput): Promise<Reminder>
  update(id: string, patch: UpdateReminderInput): Promise<Reminder>
  cancel(id: string): Promise<Reminder>
  complete(id: string): Promise<Reminder>
  snooze(id: string, minutes?: number): Promise<Reminder>
  dismiss(id: string): Promise<Reminder>
}

export interface SettingsApi {
  get(): Promise<SettingsView>
  update(patch: SettingsPatch): Promise<SettingsView>
  setApiKey(apiKey: string): Promise<SettingsView>
  clearApiKey(): Promise<SettingsView>
  testProvider(input: ProviderTestInput): Promise<ProviderTestResult>
}

export interface LogsApi {
  list(limit?: number): Promise<ActionLog[]>
}

export interface SystemApi {
  openDataDir(): Promise<void>
  showWindow(): Promise<void>
  focusComposer(): Promise<void>
}

export interface PermutationApi {
  app: {
    getBootstrap(): Promise<BootstrapPayload>
  }
  settings: SettingsApi
  chat: ChatApi
  reminders: ReminderApi
  logs: LogsApi
  system: SystemApi
  confirm: {
    respond(confirmationId: string, approved: boolean): Promise<void>
  }
  events: {
    on(listener: (event: AgentEvent) => void): () => void
  }
}
