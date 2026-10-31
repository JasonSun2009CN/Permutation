import { openDatabase } from '@permutation/db'
import { ReminderScheduler, type DueBatch } from '@permutation/scheduler'
import { APP_NAME, EVENT_CHANNEL, GLOBAL_SHORTCUT } from '@permutation/shared'
import { app, globalShortcut, nativeTheme, powerMonitor } from 'electron'
import { join } from 'node:path'
import { AgentService } from './agent-service'
import { installCaptureHook } from './capture'
import { broadcast } from './events'
import { registerIpc } from './ipc'
import { buildAppMenu } from './menu'
import { Notifier } from './notifier'
import { ReminderService } from './reminder-service'
import { SettingsService } from './settings'
import { createTray, destroyTray, refreshTray } from './tray'
import { createMainWindow, markQuitting, showMainWindow } from './window'

app.setName(APP_NAME)

if (process.env.PERMUTATION_USER_DATA_DIR && !app.isPackaged) {
  app.setPath('userData', process.env.PERMUTATION_USER_DATA_DIR)
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app
    .whenReady()
    .then(bootstrap)
    .catch((error: unknown) => {
      console.error('[main] failed to start', error)
      app.quit()
    })
}

function bootstrap(): void {
  const db = openDatabase(join(app.getPath('userData'), 'permutation.db'))
  const settings = new SettingsService(db)
  settings.applyRuntimePreferences()

  const mainWindow = createMainWindow()
  installCaptureHook(mainWindow)
  buildAppMenu(settings.language())

  const notifier = new Notifier({
    getSettings: () => settings.getView(),
    getLanguage: () => settings.language(),
    getLocale: () => settings.locale(),
    showWindow: showMainWindow,
  })

  let onDueHandler: (batch: DueBatch) => void | Promise<void> = () => undefined
  const scheduler = new ReminderScheduler({
    reminders: db.reminders,
    onDue: (batch) => onDueHandler(batch),
    onError: (error) => console.error('[scheduler] tick failed', error),
  })

  const agent = new AgentService({
    db,
    settings,
    scheduler,
    notifier,
    onRemindersChanged: refreshTray,
  })

  const reminderService = new ReminderService({
    db,
    scheduler,
    notifier,
    onChanged: refreshTray,
  })
  onDueHandler = (batch) => reminderService.handleDue(batch)

  const appInfo = {
    version: app.getVersion(),
    platform: process.platform,
    shortcut: GLOBAL_SHORTCUT,
    locale: settings.locale(),
    timezone: settings.get().timezone,
    dataDir: app.getPath('userData'),
  }

  registerIpc({
    db,
    settings,
    agent,
    reminders: reminderService,
    appInfo,
    onSettingsChanged: (view) => {
      broadcast({ type: 'settings_changed', settings: view })
      refreshTray()
      buildAppMenu(settings.language())
    },
  })

  createTray({
    getLanguage: () => settings.language(),
    getLocale: () => settings.locale(),
    getUpcoming: () => db.reminders.list({ status: 'pending', limit: 5 }),
    onOpen: showMainWindow,
    onNewReminder: () => {
      showMainWindow()
      broadcast({ type: 'new_reminder' })
    },
    onSettings: () => {
      showMainWindow()
      broadcast({ type: 'open_settings' })
    },
    onQuit: () => app.quit(),
  })

  const registered = globalShortcut.register(GLOBAL_SHORTCUT, () => {
    showMainWindow()
    broadcast({ type: 'focus_composer' })
  })
  if (!registered) {
    console.warn(`[shortcut] could not register ${GLOBAL_SHORTCUT}`)
  }

  scheduler.start()

  powerMonitor.on('resume', () => {
    void scheduler.checkNow()
  })
  powerMonitor.on('unlock-screen', () => {
    void scheduler.checkNow()
  })

  nativeTheme.on('updated', () => {
    broadcast({ type: 'settings_changed', settings: settings.getView() })
  })

  app.on('activate', () => showMainWindow())

  app.on('before-quit', () => {
    markQuitting()
  })

  app.on('will-quit', () => {
    scheduler.stop()
    globalShortcut.unregisterAll()
    destroyTray()
    db.close()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  process.on('unhandledRejection', (reason) => {
    console.error('[main] unhandled rejection', reason)
  })

  // Kept for debugging renderer reloads without losing the current window.
  app.on('web-contents-created', (_event, contents) => {
    contents.on('render-process-gone', (_e, details) => {
      console.error('[main] renderer gone', details.reason)
    })
  })

  console.info(`[main] ${APP_NAME} ready, events on ${EVENT_CHANNEL}`)
}
