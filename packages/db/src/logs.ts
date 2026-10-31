import type Database from 'better-sqlite3'
import { newId, type ActionLog, type ActionSource, type ToolCallStatus } from '@permutation/shared'

interface ActionLogRow {
  id: string
  created_at: string
  tool_name: string
  args_json: string
  result_json: string
  status: ToolCallStatus
  confirmed: number | null
  duration_ms: number
  source: ActionSource
  conversation_id: string | null
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null)
  } catch {
    return JSON.stringify(String(value))
  }
}

function toActionLog(row: ActionLogRow): ActionLog {
  return {
    id: row.id,
    createdAt: row.created_at,
    toolName: row.tool_name,
    args: safeParse(row.args_json),
    result: safeParse(row.result_json),
    status: row.status,
    confirmed: row.confirmed === null ? null : row.confirmed === 1,
    durationMs: row.duration_ms,
    source: row.source,
    conversationId: row.conversation_id,
  }
}

export interface ActionLogInput {
  toolName: string
  args: unknown
  result: unknown
  status: ToolCallStatus
  confirmed: boolean | null
  durationMs: number
  source: ActionSource
  conversationId?: string | null
}

export class ActionLogRepository {
  constructor(private readonly db: Database.Database) {}

  add(input: ActionLogInput, now: Date = new Date()): ActionLog {
    const id = newId('log')
    this.db
      .prepare(
        `INSERT INTO action_logs
          (id, created_at, tool_name, args_json, result_json, status, confirmed,
           duration_ms, source, conversation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        now.toISOString(),
        input.toolName,
        safeStringify(input.args),
        safeStringify(input.result),
        input.status,
        input.confirmed === null ? null : input.confirmed ? 1 : 0,
        Math.max(0, Math.round(input.durationMs)),
        input.source,
        input.conversationId ?? null,
      )
    const row = this.db.prepare('SELECT * FROM action_logs WHERE id = ?').get(id) as ActionLogRow
    return toActionLog(row)
  }

  list(limit = 100): ActionLog[] {
    const rows = this.db
      .prepare('SELECT * FROM action_logs ORDER BY created_at DESC, rowid DESC LIMIT ?')
      .all(Math.min(Math.max(limit, 1), 500)) as ActionLogRow[]
    return rows.map(toActionLog)
  }
}
