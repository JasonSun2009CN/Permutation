import type {
  ActionLog,
  AgentEvent,
  AppInfo,
  ChatSendResult,
  Conversation,
  CreateReminderInput,
  Reminder,
  SettingsPatch,
  SettingsView,
  StoredMessage,
  ToolCallStatus,
  UpdateReminderInput,
} from '@permutation/shared'
import { newId } from '@permutation/shared'
import { create } from 'zustand'
import { resolveLanguage, translate, type Language } from '../lib/i18n'

export type Page = 'chat' | 'today' | 'reminders' | 'activity' | 'settings'

export type LiveTraceStatus = 'running' | ToolCallStatus

export interface LiveTrace {
  callId: string
  name: string
  args: unknown
  status: LiveTraceStatus
  summary: string
  durationMs?: number
}

export interface RunState {
  runId: string
  conversationId: string
  traces: LiveTrace[]
  startedAt: number
  error?: { code: string; message: string }
}

export interface ConfirmationState {
  request: {
    id: string
    runId: string
    toolName: string
    summary: string
    args: Record<string, unknown>
    risk: 'high'
    expiresAt: string
  }
  conversationId: string
}

export interface ToastState {
  id: string
  tone: 'info' | 'success' | 'error'
  message: string
}

interface AppStore {
  bootstrapped: boolean
  loadError: string | null
  settings: SettingsView | null
  appInfo: AppInfo | null
  reminders: Reminder[]
  conversations: Conversation[]
  messages: StoredMessage[]
  selectedConversationId: string | null
  page: Page
  loadingMessages: boolean
  isSending: boolean
  runs: Record<string, RunState>
  confirmation: ConfirmationState | null
  fired: Reminder[]
  toast: ToastState | null
  composerFocusToken: number
  newReminderToken: number

  bootstrap: () => Promise<void>
  handleEvent: (event: AgentEvent) => void
  navigate: (page: Page) => void
  selectConversation: (conversationId: string) => Promise<void>
  newChat: () => void
  sendMessage: (text: string) => Promise<void>
  cancelRun: (conversationId: string) => Promise<void>
  respondConfirmation: (approved: boolean) => Promise<void>
  refreshReminders: () => Promise<void>
  refreshConversations: () => Promise<void>
  createReminder: (input: CreateReminderInput) => Promise<boolean>
  updateReminder: (id: string, patch: UpdateReminderInput) => Promise<boolean>
  completeReminder: (id: string) => Promise<void>
  snoozeReminder: (id: string, minutes?: number) => Promise<void>
  cancelReminder: (id: string) => Promise<void>
  dismissReminder: (id: string) => Promise<void>
  dismissFired: (id: string) => void
  saveSettings: (patch: SettingsPatch, apiKey?: string) => Promise<boolean>
  clearApiKey: () => Promise<boolean>
  showToast: (tone: ToastState['tone'], message: string) => void
  clearToast: () => void
  focusComposer: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

function languageOf(settings: SettingsView | null): Language {
  return resolveLanguage(settings?.language)
}

function cleanError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()
}

function errorText(language: Language, error: unknown): string {
  const message = cleanError(error)
  if (/MODEL_NOT_CONFIGURED|API_KEY_NOT_CONFIGURED|BASE_URL_NOT_CONFIGURED/.test(message)) {
    return translate(language, 'chat.notConfiguredTitle')
  }
  return message || translate(language, 'toast.error')
}

function upsertReminder(list: Reminder[], reminder: Reminder): Reminder[] {
  const next = list.filter((item) => item.id !== reminder.id)
  next.push(reminder)
  next.sort((a, b) => a.triggerAt.localeCompare(b.triggerAt))
  return next
}

function addMessage(list: StoredMessage[], message: StoredMessage): StoredMessage[] {
  if (list.some((item) => item.id === message.id)) return list
  return [...list, message]
}

function runKey(conversationId: string): string {
  return conversationId
}

export const useAppStore = create<AppStore>((set, get) => ({
  bootstrapped: false,
  loadError: null,
  settings: null,
  appInfo: null,
  reminders: [],
  conversations: [],
  messages: [],
  selectedConversationId: null,
  page: 'chat',
  loadingMessages: false,
  isSending: false,
  runs: {},
  confirmation: null,
  fired: [],
  toast: null,
  composerFocusToken: 0,
  newReminderToken: 0,

  bootstrap: async () => {
    try {
      const payload = await window.permutation.app.getBootstrap()
      set({
        bootstrapped: true,
        settings: payload.settings,
        appInfo: payload.appInfo,
        reminders: payload.reminders,
        conversations: payload.conversations,
        loadError: null,
      })
    } catch (error) {
      set({ bootstrapped: true, loadError: cleanError(error) })
    }
  },

  handleEvent: (event) => {
    const state = get()
    const language = languageOf(state.settings)

    switch (event.type) {
      case 'run_started': {
        const selected = state.selectedConversationId
        set({
          runs: {
            ...state.runs,
            [runKey(event.conversationId)]: {
              runId: event.runId,
              conversationId: event.conversationId,
              traces: [],
              startedAt: Date.now(),
            },
          },
          ...(selected === null || selected === event.conversationId
            ? {
                selectedConversationId: event.conversationId,
                messages: addMessage(state.messages, event.userMessage),
              }
            : {}),
        })
        break
      }
      case 'tool_started': {
        const existing = state.runs[runKey(event.conversationId)]
        const trace: LiveTrace = {
          callId: event.callId,
          name: event.name,
          args: event.args,
          status: 'running',
          summary: '',
        }
        const traces = existing
          ? [...existing.traces.filter((item) => item.callId !== event.callId), trace]
          : [trace]
        set({
          runs: {
            ...state.runs,
            [runKey(event.conversationId)]: {
              runId: event.runId,
              conversationId: event.conversationId,
              traces,
              startedAt: existing?.startedAt ?? Date.now(),
            },
          },
        })
        break
      }
      case 'tool_finished': {
        const existing = state.runs[runKey(event.conversationId)]
        if (!existing) break
        const trace: LiveTrace = {
          callId: event.callId,
          name: event.name,
          args: existing.traces.find((item) => item.callId === event.callId)?.args ?? {},
          status: event.status,
          summary: event.summary,
          durationMs: event.durationMs,
        }
        set({
          runs: {
            ...state.runs,
            [runKey(event.conversationId)]: {
              ...existing,
              traces: [...existing.traces.filter((item) => item.callId !== event.callId), trace],
            },
          },
        })
        break
      }
      case 'confirmation_required': {
        set({
          confirmation: {
            request: event.request,
            conversationId: event.conversationId,
          },
        })
        break
      }
      case 'confirmation_resolved': {
        if (state.confirmation?.request.id === event.confirmationId) {
          set({ confirmation: null })
        }
        break
      }
      case 'assistant_message': {
        const isSelected = state.selectedConversationId === event.conversationId
        const runs = { ...state.runs }
        delete runs[runKey(event.conversationId)]
        set({
          runs,
          ...(isSelected ? { messages: addMessage(state.messages, event.message) } : {}),
          confirmation:
            state.confirmation?.conversationId === event.conversationId ? null : state.confirmation,
        })
        break
      }
      case 'run_finished': {
        const existing = state.runs[runKey(event.conversationId)]
        if (!existing) break
        const runs = { ...state.runs }
        delete runs[runKey(event.conversationId)]
        set({ runs })
        break
      }
      case 'run_failed': {
        const existing = state.runs[runKey(event.conversationId)]
        if (!existing) break
        set({
          runs: {
            ...state.runs,
            [runKey(event.conversationId)]: {
              ...existing,
              error: { code: event.code, message: event.message },
            },
          },
          confirmation:
            state.confirmation?.conversationId === event.conversationId ? null : state.confirmation,
        })
        if (event.code !== 'cancelled') {
          const message =
            event.code === 'provider_error'
              ? translate(language, 'chat.errorProvider')
              : event.code === 'max_steps'
                ? translate(language, 'chat.errorMaxSteps')
                : translate(language, 'chat.errorUnknown')
          get().showToast('error', message)
        }
        break
      }
      case 'reminder_fired': {
        const known = new Set(state.fired.map((item) => item.id))
        const incoming = event.reminders.filter((item) => !known.has(item.id))
        set({ fired: [...state.fired, ...incoming] })
        void get().refreshReminders()
        break
      }
      case 'reminders_changed': {
        void get().refreshReminders()
        break
      }
      case 'conversations_changed': {
        void get().refreshConversations()
        break
      }
      case 'settings_changed': {
        set({ settings: event.settings })
        break
      }
      case 'focus_composer': {
        set({
          page: 'chat',
          composerFocusToken: state.composerFocusToken + 1,
        })
        break
      }
      case 'new_reminder': {
        set({
          page: 'reminders',
          newReminderToken: state.newReminderToken + 1,
        })
        break
      }
      case 'open_settings': {
        set({ page: 'settings' })
        break
      }
      case 'toast': {
        get().showToast(event.tone, event.message)
        break
      }
    }
  },

  navigate: (page) => set({ page }),

  selectConversation: async (conversationId) => {
    set({ selectedConversationId: conversationId, page: 'chat', loadingMessages: true })
    try {
      const messages = await window.permutation.chat.getMessages(conversationId)
      if (get().selectedConversationId === conversationId) {
        set({ messages, loadingMessages: false })
      }
    } catch (error) {
      set({ loadingMessages: false })
      get().showToast('error', errorText(languageOf(get().settings), error))
    }
  },

  newChat: () => {
    set({
      selectedConversationId: null,
      messages: [],
      page: 'chat',
      confirmation: null,
      composerFocusToken: get().composerFocusToken + 1,
    })
  },

  sendMessage: async (text) => {
    const state = get()
    const content = text.trim()
    if (!content || state.isSending) return

    const language = languageOf(state.settings)
    if (!state.settings?.hasApiKey || !state.settings.model) {
      get().showToast('error', translate(language, 'chat.notConfiguredTitle'))
      return
    }

    const conversationId = state.selectedConversationId
    const existingRun = conversationId ? state.runs[runKey(conversationId)] : undefined
    if (existingRun && !existingRun.error) return

    set({ isSending: true })
    try {
      const result: ChatSendResult = await window.permutation.chat.send({
        text: content,
        conversationId,
      })
      const current = get()
      const runs = { ...current.runs }
      if (!runs[runKey(result.conversationId)]) {
        runs[runKey(result.conversationId)] = {
          runId: result.runId,
          conversationId: result.conversationId,
          traces: [],
          startedAt: Date.now(),
        }
      }
      set({
        isSending: false,
        selectedConversationId: result.conversationId,
        messages: addMessage(current.messages, result.userMessage),
        runs,
      })
    } catch (error) {
      set({ isSending: false })
      get().showToast('error', errorText(language, error))
    }
  },

  cancelRun: async (conversationId) => {
    const run = get().runs[runKey(conversationId)]
    if (!run) return
    try {
      await window.permutation.chat.cancel(run.runId)
    } catch (error) {
      get().showToast('error', errorText(languageOf(get().settings), error))
    }
  },

  respondConfirmation: async (approved) => {
    const confirmation = get().confirmation
    if (!confirmation) return
    set({ confirmation: null })
    try {
      await window.permutation.confirm.respond(confirmation.request.id, approved)
    } catch (error) {
      get().showToast('error', errorText(languageOf(get().settings), error))
    }
  },

  refreshReminders: async () => {
    try {
      const reminders = await window.permutation.reminders.list({ status: 'all', limit: 500 })
      set({ reminders })
    } catch (error) {
      console.error('[store] failed to refresh reminders', error)
    }
  },

  refreshConversations: async () => {
    try {
      const conversations = await window.permutation.chat.listConversations()
      const selected = get().selectedConversationId
      set({
        conversations,
        selectedConversationId:
          selected && conversations.some((item) => item.id === selected) ? selected : selected,
      })
    } catch (error) {
      console.error('[store] failed to refresh conversations', error)
    }
  },

  createReminder: async (input) => {
    const language = languageOf(get().settings)
    try {
      const reminder = await window.permutation.reminders.create(input)
      set({ reminders: upsertReminder(get().reminders, reminder) })
      get().showToast('success', translate(language, 'toast.reminderCreated'))
      return true
    } catch (error) {
      get().showToast('error', errorText(language, error))
      return false
    }
  },

  updateReminder: async (id, patch) => {
    const language = languageOf(get().settings)
    try {
      const reminder = await window.permutation.reminders.update(id, patch)
      set({ reminders: upsertReminder(get().reminders, reminder) })
      get().showToast('success', translate(language, 'toast.reminderCreated'))
      return true
    } catch (error) {
      get().showToast('error', errorText(language, error))
      return false
    }
  },

  completeReminder: async (id) => {
    const language = languageOf(get().settings)
    try {
      const reminder = await window.permutation.reminders.complete(id)
      set({
        reminders: upsertReminder(get().reminders, reminder),
        fired: get().fired.filter((item) => item.id !== id),
      })
      get().showToast('success', translate(language, 'reminders.completedToast'))
    } catch (error) {
      get().showToast('error', errorText(language, error))
    }
  },

  snoozeReminder: async (id, minutes = 10) => {
    const language = languageOf(get().settings)
    try {
      const reminder = await window.permutation.reminders.snooze(id, minutes)
      set({
        reminders: upsertReminder(get().reminders, reminder),
        fired: get().fired.filter((item) => item.id !== id),
      })
      get().showToast('success', translate(language, 'reminders.snoozedToast'))
    } catch (error) {
      get().showToast('error', errorText(language, error))
    }
  },

  cancelReminder: async (id) => {
    const language = languageOf(get().settings)
    try {
      const reminder = await window.permutation.reminders.cancel(id)
      set({
        reminders: upsertReminder(get().reminders, reminder),
        fired: get().fired.filter((item) => item.id !== id),
      })
      get().showToast('success', translate(language, 'reminders.cancelledToast'))
    } catch (error) {
      get().showToast('error', errorText(language, error))
    }
  },

  dismissFired: (id) => set({ fired: get().fired.filter((item) => item.id !== id) }),

  dismissReminder: async (id) => {
    const language = languageOf(get().settings)
    try {
      const reminder = await window.permutation.reminders.dismiss(id)
      set({
        reminders: upsertReminder(get().reminders, reminder),
        fired: get().fired.filter((item) => item.id !== id),
      })
    } catch (error) {
      get().showToast('error', errorText(language, error))
    }
  },

  saveSettings: async (patch, apiKey) => {
    const language = languageOf(get().settings)
    try {
      let settings = await window.permutation.settings.update(patch)
      if (apiKey && apiKey.trim()) {
        settings = await window.permutation.settings.setApiKey(apiKey)
      }
      set({ settings })
      get().showToast('success', translate(language, 'settings.saved'))
      return true
    } catch (error) {
      get().showToast('error', errorText(language, error))
      return false
    }
  },

  clearApiKey: async () => {
    const language = languageOf(get().settings)
    try {
      const settings = await window.permutation.settings.clearApiKey()
      set({ settings })
      get().showToast('success', translate(language, 'settings.keyCleared'))
      return true
    } catch (error) {
      get().showToast('error', errorText(language, error))
      return false
    }
  },

  showToast: (tone, message) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: { id: newId('toast'), tone, message } })
    toastTimer = setTimeout(() => set({ toast: null }), 4200)
  },

  clearToast: () => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: null })
  },

  focusComposer: () => {
    set({ page: 'chat', composerFocusToken: get().composerFocusToken + 1 })
  },
}))

export function selectOpenReminders(reminders: Reminder[]): Reminder[] {
  return reminders.filter(
    (reminder) => reminder.status === 'pending' || reminder.status === 'fired',
  )
}

export function selectTodayReminders(reminders: Reminder[], now = new Date()): Reminder[] {
  return selectOpenReminders(reminders).filter((reminder) => {
    const date = new Date(reminder.triggerAt)
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    )
  })
}

export type { ActionLog, SettingsPatch, StoredMessage }
