const { app, safeStorage } = require('electron')
const Database = require('better-sqlite3')

const dbPath = process.argv[2]
const apiKey = process.argv[3]

if (!dbPath || !apiKey) {
  console.error('Usage: electron scripts/seed-api-key.cjs <db-path> <api-key>')
  app.quit()
} else {
  app
    .whenReady()
    .then(() => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage is not available on this machine')
      }
      const db = new Database(dbPath)
      db.prepare(
        `INSERT INTO secrets (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ).run('llm_api_key', safeStorage.encryptString(apiKey), new Date().toISOString())
      db.close()
      console.log(`Stored an encrypted API key in ${dbPath}`)
      app.quit()
    })
    .catch((error) => {
      console.error(error)
      app.exit(1)
    })
}
