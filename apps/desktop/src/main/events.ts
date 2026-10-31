import { EVENT_CHANNEL } from '@permutation/shared'
import type { AgentEvent } from '@permutation/shared'
import { BrowserWindow } from 'electron'

export function broadcast(event: AgentEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(EVENT_CHANNEL, event)
    }
  }
}
