import type { Reminder, SettingsView } from '@permutation/shared'
import { Notification } from 'electron'
import { execFile } from 'node:child_process'
import { mainStrings, type MainLanguage } from './i18n'

export interface ReminderNotificationHandlers {
  onComplete: () => void
  onSnooze: () => void
  onDismiss: () => void
}

interface NotifierDeps {
  getSettings: () => SettingsView
  getLanguage: () => MainLanguage
  getLocale: () => string
  showWindow: () => void
}

export class Notifier {
  private readonly live = new Set<Notification>()

  constructor(private readonly deps: NotifierDeps) {}

  notify(title: string, body: string): boolean {
    return this.show(title, body, null)
  }

  showReminder(reminder: Reminder, handlers: ReminderNotificationHandlers): boolean {
    const settings = this.deps.getSettings()
    if (!settings.notificationsEnabled) return false

    const language = this.deps.getLanguage()
    const strings = mainStrings(language)
    const when = new Intl.DateTimeFormat(this.deps.getLocale(), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(reminder.triggerAt))
    const body = `${reminder.content}\n${when}`

    if (process.platform !== 'darwin') {
      return this.show(strings.reminderTitle, body, null)
    }

    return this.show(
      strings.reminderTitle,
      body,
      [
        { type: 'button', text: strings.notificationComplete },
        { type: 'button', text: strings.notificationSnooze },
        { type: 'button', text: strings.notificationDismiss },
      ],
      {
        actions: [handlers.onComplete, handlers.onSnooze, handlers.onDismiss],
      },
    )
  }

  showMissedSummary(count: number): boolean {
    const language = this.deps.getLanguage()
    const strings = mainStrings(language)
    return this.show(strings.missedSummaryTitle(count), strings.missedSummaryBody, null, {
      onOpen: this.deps.showWindow,
    })
  }

  private show(
    title: string,
    body: string,
    actions: Array<{ type: 'button'; text: string }> | null,
    options: { onOpen?: () => void; actions?: Array<() => void> } = {},
  ): boolean {
    if (!this.deps.getSettings().notificationsEnabled) return false

    if (!Notification.isSupported()) {
      return this.showViaAppleScript(title, body)
    }

    try {
      const notification = new Notification({
        title,
        body,
        silent: !this.deps.getSettings().notificationSound,
        ...(actions
          ? { actions, closeButtonText: mainStrings(this.deps.getLanguage()).notificationDismiss }
          : {}),
      })
      this.live.add(notification)

      let fallbackUsed = false
      const useFallback = () => {
        if (fallbackUsed) return
        fallbackUsed = true
        console.warn('[notifier] Electron notification failed; using AppleScript fallback')
        this.showViaAppleScript(title, body)
      }

      const cleanup = () => {
        this.live.delete(notification)
      }
      notification.on('close', cleanup)
      notification.on('failed', () => {
        cleanup()
        useFallback()
      })
      notification.on('click', () => {
        this.deps.showWindow()
        options.onOpen?.()
      })
      if (options.actions) {
        notification.on('action', (_event, index) => {
          options.actions?.[index]?.()
        })
      }
      notification.show()
      setTimeout(cleanup, 10 * 60_000)
      return true
    } catch (error) {
      console.error('[notifier] failed to show notification, trying fallback', error)
      return this.showViaAppleScript(title, body)
    }
  }

  /**
   * macOS denies UNUserNotificationCenter for some unsigned/dev builds.
   * AppleScript still reaches Notification Center, without action buttons;
   * the in-app card remains the interactive fallback.
   */
  private showViaAppleScript(title: string, body: string): boolean {
    if (process.platform !== 'darwin') return false
    execFile(
      'osascript',
      [
        '-e',
        'on run argv',
        '-e',
        'display notification (item 2 of argv) with title (item 1 of argv)',
        '-e',
        'end run',
        '--',
        title,
        body,
      ],
      (error) => {
        if (error) console.error('[notifier] AppleScript notification failed', error)
      },
    )
    return true
  }
}
