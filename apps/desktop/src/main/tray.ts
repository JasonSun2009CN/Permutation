import type { Reminder } from '@permutation/shared'
import { Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import { mainStrings, type MainLanguage } from './i18n'

interface TrayDeps {
  getLanguage: () => MainLanguage
  getLocale: () => string
  getUpcoming: () => Reminder[]
  onOpen: () => void
  onNewReminder: () => void
  onSettings: () => void
  onQuit: () => void
}

let tray: Tray | null = null
let deps: TrayDeps | null = null

export function createTray(nextDeps: TrayDeps): void {
  deps = nextDeps
  const iconPath = join(__dirname, '../../resources/trayTemplate.png')
  const image = nativeImage.createFromPath(iconPath)
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  if (process.platform === 'darwin') {
    tray.setIgnoreDoubleClickEvents(true)
  }
  tray.setToolTip('Permutation')
  refreshTray()
}

export function refreshTray(): void {
  if (!tray || !deps) return
  const language = deps.getLanguage()
  const strings = mainStrings(language)
  const upcoming = deps.getUpcoming()
  const formatter = new Intl.DateTimeFormat(deps.getLocale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const upcomingItems = upcoming.slice(0, 5).map((reminder) => ({
    label: `${formatter.format(new Date(reminder.triggerAt))}  ${truncate(reminder.content, 42)}`,
    enabled: false,
  }))

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: strings.trayOpen, click: deps.onOpen },
      { label: strings.trayNewReminder, click: deps.onNewReminder },
      { type: 'separator' },
      { label: strings.trayUpcoming, enabled: false },
      ...(upcomingItems.length > 0
        ? upcomingItems
        : [{ label: strings.trayNoUpcoming, enabled: false }]),
      { type: 'separator' },
      { label: strings.traySettings, click: deps.onSettings },
      { label: strings.trayQuit, click: deps.onQuit },
    ]),
  )
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
  deps = null
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
