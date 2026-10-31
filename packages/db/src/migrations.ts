export interface Migration {
  version: number
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE reminders (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        trigger_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'fired', 'completed', 'dismissed', 'cancelled')),
        source TEXT NOT NULL DEFAULT 'chat'
          CHECK (source IN ('chat', 'manual', 'system')),
        conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
        fired_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_reminders_status_trigger ON reminders (status, trigger_at);

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        tools_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);

      CREATE TABLE action_logs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        args_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ok', 'error', 'denied')),
        confirmed INTEGER,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL CHECK (source IN ('chat', 'ui', 'notification', 'system')),
        conversation_id TEXT
      );

      CREATE INDEX idx_action_logs_created ON action_logs (created_at DESC);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE secrets (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'chat',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
]
