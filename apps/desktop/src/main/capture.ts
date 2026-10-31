import { EVENT_CHANNEL, newId } from '@permutation/shared'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'

/**
 * Dev-only visual QA hook. Set PERMUTATION_CAPTURE_PATH (and optionally
 * PERMUTATION_CAPTURE_PAGE) to save a PNG of the window and quit. This keeps
 * design review possible on machines without screen-recording permission.
 */
export function installCaptureHook(window: BrowserWindow): void {
  if (app.isPackaged) return
  const target = process.env.PERMUTATION_CAPTURE_PATH
  if (!target) return
  const page = process.env.PERMUTATION_CAPTURE_PAGE
  const selectConversation = process.env.PERMUTATION_CAPTURE_CONVERSATION === '1'
  const showPopup = process.env.PERMUTATION_CAPTURE_POPUP === '1'
  const showConfirmation = process.env.PERMUTATION_CAPTURE_CONFIRM === '1'
  const chat = process.env.PERMUTATION_CAPTURE_CHAT

  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        if (page) {
          await window.webContents
            .executeJavaScript(`document.querySelector('[data-page="${page}"]')?.click()`)
            .catch(() => undefined)
          await new Promise((resolve) => setTimeout(resolve, 900))
        }
        if (selectConversation) {
          await window.webContents
            .executeJavaScript(`document.querySelector('[data-conversation]')?.click()`)
            .catch(() => undefined)
          await new Promise((resolve) => setTimeout(resolve, 900))
        }
        if (chat) {
          await window.webContents
            .executeJavaScript(
              `(() => {
                const textarea = document.querySelector('textarea');
                if (!textarea) return false;
                const setter = Object.getOwnPropertyDescriptor(
                  window.HTMLTextAreaElement.prototype,
                  'value'
                ).set;
                setter.call(textarea, ${JSON.stringify(chat)});
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
              })()`,
            )
            .catch(() => undefined)
          await new Promise((resolve) => setTimeout(resolve, 400))
          await window.webContents
            .executeJavaScript(`document.querySelector('[data-send]')?.click()`)
            .catch(() => undefined)
          const waitMs = Number(process.env.PERMUTATION_CAPTURE_CHAT_WAIT ?? 6000)
          await new Promise((resolve) => setTimeout(resolve, waitMs))
        }
        if (showPopup) {
          const now = new Date().toISOString()
          window.webContents.send(EVENT_CHANNEL, {
            type: 'reminder_fired',
            missed: false,
            reminders: [
              {
                id: newId('rem_qa'),
                content: '喝水，站起来活动一下',
                triggerAt: now,
                status: 'fired',
                source: 'system',
                conversationId: null,
                firedAt: now,
                createdAt: now,
                updatedAt: now,
              },
            ],
          })
          await new Promise((resolve) => setTimeout(resolve, 1400))
        }
        if (showConfirmation) {
          window.webContents.send(EVENT_CHANNEL, {
            type: 'confirmation_required',
            runId: 'run_qa',
            conversationId: 'conv_qa',
            request: {
              id: 'cfm_qa',
              runId: 'run_qa',
              toolName: 'cancel_reminder',
              summary: '取消提醒“交报告”（10月31日 15:00）',
              args: { id: 'rem_qa' },
              risk: 'high',
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
          })
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        const image = await window.webContents.capturePage()
        writeFileSync(target, image.toPNG())
        app.quit()
      })().catch((error: unknown) => {
        console.error('[capture] failed', error)
        app.quit()
      })
    }, 1800)
  })
}
