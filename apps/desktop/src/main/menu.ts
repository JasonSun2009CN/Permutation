import { EVENT_CHANNEL } from '@permutation/shared'
import { BrowserWindow, Menu, app } from 'electron'
import { mainStrings, type MainLanguage } from './i18n'
import { showMainWindow } from './window'

export function buildAppMenu(language: MainLanguage): void {
  const strings = mainStrings(language)
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: strings.traySettings,
                accelerator: 'CommandOrControl+,',
                click: () => {
                  showMainWindow()
                  for (const window of BrowserWindow.getAllWindows()) {
                    window.webContents.send(EVENT_CHANNEL, { type: 'open_settings' })
                  }
                },
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: strings.menuEdit,
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: strings.menuView,
      submenu: [
        ...(app.isPackaged
          ? []
          : ([
              { role: 'reload' },
              { role: 'toggleDevTools' },
            ] as Electron.MenuItemConstructorOptions[])),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: strings.menuWindow,
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
