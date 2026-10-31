import type Database from 'better-sqlite3'

export class SettingsRepository {
  constructor(private readonly db: Database.Database) {}

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      { value: string } | undefined
    return row?.value ?? null
  }

  set(key: string, value: string, now: Date = new Date()): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, now.toISOString())
  }

  setMany(entries: Record<string, string>, now: Date = new Date()): void {
    const statement = this.db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    const transaction = this.db.transaction(() => {
      for (const [key, value] of Object.entries(entries)) {
        statement.run(key, value, now.toISOString())
      }
    })
    transaction()
  }

  getAll(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{
      key: string
      value: string
    }>
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  }
}

export class SecretRepository {
  constructor(private readonly db: Database.Database) {}

  set(key: string, value: Buffer, now: Date = new Date()): void {
    this.db
      .prepare(
        `INSERT INTO secrets (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, now.toISOString())
  }

  get(key: string): Buffer | null {
    const row = this.db.prepare('SELECT value FROM secrets WHERE key = ?').get(key) as
      { value: Buffer } | undefined
    return row?.value ?? null
  }

  has(key: string): boolean {
    const row = this.db.prepare('SELECT 1 AS present FROM secrets WHERE key = ?').get(key)
    return row !== undefined
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM secrets WHERE key = ?').run(key)
  }
}
