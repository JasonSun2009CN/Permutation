import type Database from 'better-sqlite3'
import {
  newId,
  normalizeZonedIso,
  type Reminder,
  type ReminderFilter,
  type ReminderStatus,
  type UpdateReminderInput,
  type CreateReminderInput,
} from '@permutation/shared'

interface ReminderRow {
  id: string
  content: string
  trigger_at: string
  status: ReminderStatus
  source: Reminder['source']
  conversation_id: string | null
  fired_at: string | null
  created_at: string
  updated_at: string
}

function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    content: row.content,
    triggerAt: row.trigger_at,
    status: row.status,
    source: row.source,
    conversationId: row.conversation_id,
    firedAt: row.fired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ReminderRepository {
  constructor(private readonly db: Database.Database) {}

  get(id: string): Reminder | null {
    const row = this.db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as
      ReminderRow | undefined
    return row ? toReminder(row) : null
  }

  create(input: CreateReminderInput, now: Date = new Date()): Reminder {
    const timestamp = now.toISOString()
    const id = newId('rem')
    this.db
      .prepare(
        `INSERT INTO reminders
          (id, content, trigger_at, status, source, conversation_id, fired_at, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, NULL, ?, ?)`,
      )
      .run(
        id,
        input.content.trim(),
        normalizeZonedIso(input.triggerAt),
        input.source ?? 'chat',
        input.conversationId ?? null,
        timestamp,
        timestamp,
      )
    return this.get(id) as Reminder
  }

  list(filter: ReminderFilter = {}): Reminder[] {
    const clauses: string[] = []
    const params: unknown[] = []

    if (filter.status === 'open') {
      clauses.push("status IN ('pending', 'fired')")
    } else if (filter.status && filter.status !== 'all') {
      clauses.push('status = ?')
      params.push(filter.status)
    }
    if (filter.from) {
      clauses.push('trigger_at >= ?')
      params.push(normalizeZonedIso(filter.from))
    }
    if (filter.to) {
      clauses.push('trigger_at <= ?')
      params.push(normalizeZonedIso(filter.to))
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000)
    const rows = this.db
      .prepare(`SELECT * FROM reminders ${where} ORDER BY trigger_at ASC LIMIT ?`)
      .all(...params, limit) as ReminderRow[]
    return rows.map(toReminder)
  }

  update(id: string, patch: UpdateReminderInput, now: Date = new Date()): Reminder {
    const existing = this.require(id)
    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new Error(`Reminder ${id} is ${existing.status} and can no longer be edited`)
    }

    const nextTrigger = patch.triggerAt ? normalizeZonedIso(patch.triggerAt) : existing.triggerAt
    const nextContent = patch.content?.trim() || existing.content
    const resetFired = existing.status === 'fired'
    this.db
      .prepare(
        `UPDATE reminders
            SET content = ?, trigger_at = ?, updated_at = ?,
                status = CASE WHEN ? THEN 'pending' ELSE status END,
                fired_at = CASE WHEN ? THEN NULL ELSE fired_at END
          WHERE id = ?`,
      )
      .run(nextContent, nextTrigger, now.toISOString(), resetFired ? 1 : 0, resetFired ? 1 : 0, id)
    return this.get(id) as Reminder
  }

  cancel(id: string, now: Date = new Date()): Reminder {
    return this.setStatus(id, 'cancelled', now)
  }

  complete(id: string, now: Date = new Date()): Reminder {
    return this.setStatus(id, 'completed', now)
  }

  dismiss(id: string, now: Date = new Date()): Reminder {
    return this.setStatus(id, 'dismissed', now)
  }

  snooze(id: string, minutes: number, now: Date = new Date()): Reminder {
    this.require(id)
    const triggerAt = new Date(now.getTime() + minutes * 60_000).toISOString()
    this.db
      .prepare(
        `UPDATE reminders
            SET status = 'pending', trigger_at = ?, fired_at = NULL, updated_at = ?
          WHERE id = ?`,
      )
      .run(triggerAt, now.toISOString(), id)
    return this.get(id) as Reminder
  }

  due(now: Date = new Date()): Reminder[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM reminders
          WHERE status = 'pending' AND trigger_at <= ?
          ORDER BY trigger_at ASC`,
      )
      .all(now.toISOString()) as ReminderRow[]
    return rows.map(toReminder)
  }

  markFired(id: string, firedAt: Date = new Date()): Reminder {
    this.db
      .prepare(
        `UPDATE reminders
            SET status = 'fired', fired_at = ?, updated_at = ?
          WHERE id = ? AND status = 'pending'`,
      )
      .run(firedAt.toISOString(), firedAt.toISOString(), id)
    return this.get(id) as Reminder
  }

  private setStatus(id: string, status: ReminderStatus, now: Date): Reminder {
    this.require(id)
    this.db
      .prepare('UPDATE reminders SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now.toISOString(), id)
    return this.get(id) as Reminder
  }

  private require(id: string): Reminder {
    const reminder = this.get(id)
    if (!reminder) throw new Error(`Reminder not found: ${id}`)
    return reminder
  }
}
