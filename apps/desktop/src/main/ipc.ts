import { createProvider } from '@permutation/agent'
import type { PermutationDatabase } from '@permutation/db'
import type {
  AppInfo,
  ChatSendInput,
  CreateReminderInput,
  ProviderTestInput,
  ReminderFilter,
  SettingsPatch,
  SettingsView,
  UpdateReminderInput,
} from '@permutation/shared'
import { app, ipcMain, shell } from 'electron'
import type { AgentService } from './agent-service'
import type { ReminderService } from './reminder-service'
import type { SettingsService } from './settings'
import { focusComposer, showMainWindow } from './window'

interface IpcDeps {
  db: PermutationDatabase
  settings: SettingsService
  agent: AgentService
  reminders: ReminderService
  appInfo: AppInfo
  onSettingsChanged: (settings: SettingsView) => void
}

export function registerIpc(deps: IpcDeps): void {
  const { db, settings, agent, reminders } = deps

  ipcMain.handle('app:getBootstrap', () => ({
    settings: settings.getView(),
    reminders: db.reminders.list({ status: 'all', limit: 500 }),
    conversations: db.conversations.list(),
    appInfo: deps.appInfo,
  }))

  ipcMain.handle('settings:get', () => settings.getView())

  ipcMain.handle('settings:update', (_event, patch: SettingsPatch) => {
    const view = settings.update(patch)
    settings.applyRuntimePreferences()
    deps.onSettingsChanged(view)
    return view
  })

  ipcMain.handle('settings:setApiKey', (_event, apiKey: string) => {
    const view = settings.setApiKey(apiKey)
    deps.onSettingsChanged(view)
    return view
  })

  ipcMain.handle('settings:clearApiKey', () => {
    const view = settings.clearApiKey()
    deps.onSettingsChanged(view)
    return view
  })

  ipcMain.handle('settings:testProvider', async (_event, input: ProviderTestInput) => {
    const startedAt = Date.now()
    try {
      const provider = createProvider(settings.providerConfig(input))
      const result = await provider.ping()
      return {
        ok: true,
        latencyMs: result.latencyMs,
        message: result.text.trim().slice(0, 120) || 'OK',
      }
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle('chat:send', (_event, input: ChatSendInput) => agent.send(input))
  ipcMain.handle('chat:cancel', (_event, runId: string) => agent.cancel(runId))
  ipcMain.handle('chat:listConversations', () => db.conversations.list())
  ipcMain.handle('chat:getMessages', (_event, conversationId: string) =>
    db.messages.list(conversationId),
  )

  ipcMain.handle('reminders:list', (_event, filter: ReminderFilter) => reminders.list(filter))
  ipcMain.handle('reminders:create', (_event, input: CreateReminderInput) =>
    reminders.create(input),
  )
  ipcMain.handle('reminders:update', (_event, id: string, patch: UpdateReminderInput) =>
    reminders.update(id, patch),
  )
  ipcMain.handle('reminders:cancel', (_event, id: string) => reminders.cancel(id, 'ui'))
  ipcMain.handle('reminders:complete', (_event, id: string) => reminders.complete(id, 'ui'))
  ipcMain.handle('reminders:snooze', (_event, id: string, minutes?: number) =>
    reminders.snooze(id, minutes, 'ui'),
  )
  ipcMain.handle('reminders:dismiss', (_event, id: string) => reminders.dismiss(id, 'ui'))

  ipcMain.handle('confirm:respond', (_event, confirmationId: string, approved: boolean) => {
    agent.respondConfirmation(confirmationId, approved)
  })

  ipcMain.handle('logs:list', (_event, limit?: number) => db.logs.list(limit))

  ipcMain.handle('system:openDataDir', async () => {
    await shell.openPath(app.getPath('userData'))
  })
  ipcMain.handle('system:showWindow', () => {
    showMainWindow()
  })
  ipcMain.handle('system:focusComposer', () => {
    focusComposer()
  })
}
