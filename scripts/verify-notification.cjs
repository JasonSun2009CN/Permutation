const { execFile } = require('node:child_process')
const { app, Notification } = require('electron')

app.setName('Permutation')

function fallback(title, body) {
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
      if (error) {
        console.error('[verify-notification] AppleScript fallback failed', error)
      } else {
        console.log('[verify-notification] AppleScript fallback delivered')
      }
    },
  )
}

app
  .whenReady()
  .then(() => {
    if (!Notification.isSupported()) {
      console.error('Notifications are not supported on this system; trying fallback.')
      fallback('Permutation · Notification check', 'Fallback notification path.')
      setTimeout(() => app.quit(), 3000)
      return
    }
    const notification = new Notification({
      title: 'Permutation · Notification check',
      body: 'If you can see this, system notifications work. Actions appear when the notification is expanded.',
      actions: [
        { type: 'button', text: 'Complete' },
        { type: 'button', text: 'Snooze 10 min' },
        { type: 'button', text: 'Dismiss' },
      ],
      closeButtonText: 'Dismiss',
    })
    notification.on('action', (_event, index) => {
      console.log(`[verify-notification] action index=${index}`)
    })
    notification.on('click', () => {
      console.log('[verify-notification] notification clicked')
    })
    notification.on('failed', (_event, error) => {
      console.warn('[verify-notification] Electron notification failed:', String(error))
      console.warn('[verify-notification] this environment requires the AppleScript fallback')
      fallback('Permutation · Notification check', 'Fallback notification path.')
    })
    notification.show()
    console.log('[verify-notification] notification shown; quitting in 15 seconds')
    setTimeout(() => app.quit(), 15_000)
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
