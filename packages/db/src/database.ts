import Database from 'better-sqlite3'
import { MIGRATIONS } from './migrations'
import { ReminderRepository } from './reminders'
import { ConversationRepository, MessageRepository } from './conversations'
import { ActionLogRepository } from './logs'
import { SecretRepository, SettingsRepository } from './settings'

export class PermutationDatabase {
  readonly raw: Database.Database
  readonly reminders: ReminderRepository
  readonly conversations: ConversationRepository
  readonly messages: MessageRepository
  readonly logs: ActionLogRepository
  readonly settings: SettingsRepository
  readonly secrets: SecretRepository

  constructor(filename: string) {
    this.raw = new Database(filename)
    if (filename !== ':memory:') {
      this.raw.pragma('journal_mode = WAL')
    }
    this.raw.pragma('foreign_keys = ON')
    this.raw.pragma('busy_timeout = 5000')
    this.migrate()

    this.reminders = new ReminderRepository(this.raw)
    this.conversations = new ConversationRepository(this.raw)
    this.messages = new MessageRepository(this.raw)
    this.logs = new ActionLogRepository(this.raw)
    this.settings = new SettingsRepository(this.raw)
    this.secrets = new SecretRepository(this.raw)
  }

  migrate(): void {
    this.raw
      .prepare(
        'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
      )
      .run()

    const applied = new Set(
      (
        this.raw.prepare('SELECT version FROM schema_migrations').all() as Array<{
          version: number
        }>
      ).map((row) => row.version),
    )

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue
      const apply = this.raw.transaction(() => {
        this.raw.exec(migration.sql)
        this.raw
          .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, new Date().toISOString())
      })
      apply()
    }
  }

  close(): void {
    this.raw.close()
  }
}

export function openDatabase(filename: string): PermutationDatabase {
  return new PermutationDatabase(filename)
}

export * from './migrations'
export * from './reminders'
export * from './conversations'
export * from './logs'
export * from './settings'
