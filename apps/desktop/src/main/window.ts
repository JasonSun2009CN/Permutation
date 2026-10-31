import { EVENT_CHANNEL } from '@permutation/shared'
import { BrowserWindow, app, shell } from 'electron'
import { join } from 'node:path'

let mainWindow: BrowserWindow | null = null
let quitting = false

export function markQuitting(): void {
  quitting = true
}

export function isQuitting(): boolean {
  return quitting
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 940,
    minHeight: 640,
    show: false,
    backgroundColor: '#f6f7f5',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 22 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      window.hide()
    }
  })

  window.on('closed', () => {
    mainWindow = null
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = window
  return window
}

export function showMainWindow(): void {
  const window = mainWindow
  if (!window) {
    createMainWindow()
    return
  }
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  app.dock?.show()
}

export function hideMainWindow(): void {
  mainWindow?.hide()
}

export function toggleMainWindow(): void {
  if (!mainWindow) {
    createMainWindow()
    return
  }
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide()
  } else {
    showMainWindow()
  }
}

export function focusComposer(): void {
  showMainWindow()
  mainWindow?.webContents.send(EVENT_CHANNEL, { type: 'focus_composer' })
}
