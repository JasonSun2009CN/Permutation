import { EVENT_CHANNEL } from '@permutation/shared'
import type {
  AgentEvent,
  ChatSendInput,
  CreateReminderInput,
  PermutationApi,
  ProviderTestInput,
  ReminderFilter,
  SettingsPatch,
  UpdateReminderInput,
} from '@permutation/shared'
import { contextBridge, ipcRenderer } from 'electron'

const api: PermutationApi = {
  app: {
    getBootstrap: () => ipcRenderer.invoke('app:getBootstrap'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch: SettingsPatch) => ipcRenderer.invoke('settings:update', patch),
    setApiKey: (apiKey: string) => ipcRenderer.invoke('settings:setApiKey', apiKey),
    clearApiKey: () => ipcRenderer.invoke('settings:clearApiKey'),
    testProvider: (input: ProviderTestInput) => ipcRenderer.invoke('settings:testProvider', input),
  },
  chat: {
    send: (input: ChatSendInput) => ipcRenderer.invoke('chat:send', input),
    cancel: (runId: string) => ipcRenderer.invoke('chat:cancel', runId),
    listConversations: () => ipcRenderer.invoke('chat:listConversations'),
    getMessages: (conversationId: string) => ipcRenderer.invoke('chat:getMessages', conversationId),
  },
  reminders: {
    list: (filter?: ReminderFilter) => ipcRenderer.invoke('reminders:list', filter ?? {}),
    create: (input: CreateReminderInput) => ipcRenderer.invoke('reminders:create', input),
    update: (id: string, patch: UpdateReminderInput) =>
      ipcRenderer.invoke('reminders:update', id, patch),
    cancel: (id: string) => ipcRenderer.invoke('reminders:cancel', id),
    complete: (id: string) => ipcRenderer.invoke('reminders:complete', id),
    snooze: (id: string, minutes?: number) => ipcRenderer.invoke('reminders:snooze', id, minutes),
    dismiss: (id: string) => ipcRenderer.invoke('reminders:dismiss', id),
  },
  logs: {
    list: (limit?: number) => ipcRenderer.invoke('logs:list', limit),
  },
  system: {
    openDataDir: () => ipcRenderer.invoke('system:openDataDir'),
    showWindow: () => ipcRenderer.invoke('system:showWindow'),
    focusComposer: () => ipcRenderer.invoke('system:focusComposer'),
  },
  confirm: {
    respond: (confirmationId: string, approved: boolean) =>
      ipcRenderer.invoke('confirm:respond', confirmationId, approved),
  },
  events: {
    on: (listener: (event: AgentEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: AgentEvent) => listener(event)
      ipcRenderer.on(EVENT_CHANNEL, handler)
      return () => {
        ipcRenderer.removeListener(EVENT_CHANNEL, handler)
      }
    },
  },
}

contextBridge.exposeInMainWorld('permutation', api)
