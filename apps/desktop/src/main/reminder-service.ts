import type { PermutationDatabase } from '@permutation/db'
import type { ReminderScheduler, DueBatch } from '@permutation/scheduler'
import {
  DEFAULT_SNOOZE_MINUTES,
  normalizeZonedIso,
  type ActionSource,
  type CreateReminderInput,
  type Reminder,
  type ReminderFilter,
  type UpdateReminderInput,
} from '@permutation/shared'
import { broadcast } from './events'
import type { Notifier } from './notifier'

interface ReminderServiceDeps {
  db: PermutationDatabase
  scheduler: ReminderScheduler
  notifier: Notifier
  onChanged: () => void
}

export class ReminderService {
  constructor(private readonly deps: ReminderServiceDeps) {}

  list(filter: ReminderFilter = {}): Reminder[] {
    return this.deps.db.reminders.list(filter)
  }

  async create(input: CreateReminderInput): Promise<Reminder> {
    const content = input.content.trim()
    if (!content) throw new Error('Reminder content cannot be empty')
    const triggerAt = normalizeZonedIso(input.triggerAt)
    if (new Date(triggerAt).getTime() < Date.now() - 60_000) {
      throw new Error('Reminder time must be in the future')
    }

    const startedAt = Date.now()
    try {
      const reminder = this.deps.db.reminders.create(
        {
          content,
          triggerAt,
          source: input.source ?? 'manual',
          conversationId: input.conversationId ?? null,
        },
        new Date(),
      )
      this.log('create_reminder', { content, triggerAt }, reminder, 'ok', null, 'ui', startedAt)
      this.changed()
      await this.deps.scheduler.checkNow()
      return reminder
    } catch (error) {
      this.log(
        'create_reminder',
        { content, triggerAt },
        errorMessage(error),
        'error',
        null,
        'ui',
        startedAt,
      )
      throw error
    }
  }

  update(id: string, patch: UpdateReminderInput): Reminder {
    const startedAt = Date.now()
    try {
      const reminder = this.deps.db.reminders.update(id, patch, new Date())
      this.log('update_reminder', { id, ...patch }, reminder, 'ok', null, 'ui', startedAt)
      this.changed()
      void this.deps.scheduler.checkNow()
      return reminder
    } catch (error) {
      this.log(
        'update_reminder',
        { id, ...patch },
        errorMessage(error),
        'error',
        null,
        'ui',
        startedAt,
      )
      throw error
    }
  }

  cancel(id: string, source: ActionSource = 'ui'): Reminder {
    return this.change('cancel_reminder', id, source, true, (reminder) =>
      this.deps.db.reminders.cancel(reminder.id, new Date()),
    )
  }

  complete(id: string, source: ActionSource = 'ui'): Reminder {
    return this.change('complete_reminder', id, source, null, (reminder) =>
      this.deps.db.reminders.complete(reminder.id, new Date()),
    )
  }

  dismiss(id: string, source: ActionSource = 'ui'): Reminder {
    return this.change('dismiss_reminder', id, source, null, (reminder) =>
      this.deps.db.reminders.dismiss(reminder.id, new Date()),
    )
  }

  snooze(id: string, minutes = DEFAULT_SNOOZE_MINUTES, source: ActionSource = 'ui'): Reminder {
    const reminder = this.change('snooze_reminder', id, source, null, (existing) =>
      this.deps.db.reminders.snooze(existing.id, minutes, new Date()),
    )
    void this.deps.scheduler.checkNow()
    return reminder
  }

  async handleDue(batch: DueBatch): Promise<void> {
    if (batch.reminders.length === 0) return

    broadcast({ type: 'reminder_fired', reminders: batch.reminders, missed: batch.missed })
    this.deps.db.logs.add({
      toolName: 'reminder_fired',
      args: { ids: batch.reminders.map((reminder) => reminder.id), missed: batch.missed },
      result: { count: batch.reminders.length },
      status: 'ok',
      confirmed: null,
      durationMs: 0,
      source: 'system',
      conversationId: null,
    })

    if (batch.reminders.length > 2) {
      this.deps.notifier.showMissedSummary(batch.reminders.length)
    } else {
      for (const reminder of batch.reminders.slice(0, 3)) {
        this.deps.notifier.showReminder(reminder, {
          onComplete: () =>
            void this.safeNotificationAction(() => this.complete(reminder.id, 'notification')),
          onSnooze: () =>
            void this.safeNotificationAction(() =>
              this.snooze(reminder.id, DEFAULT_SNOOZE_MINUTES, 'notification'),
            ),
          onDismiss: () =>
            void this.safeNotificationAction(() => this.dismiss(reminder.id, 'notification')),
        })
      }
    }

    this.changed()
  }

  private change(
    toolName: string,
    id: string,
    source: ActionSource,
    confirmed: boolean | null,
    mutate: (reminder: Reminder) => Reminder,
  ): Reminder {
    const startedAt = Date.now()
    try {
      const existing = this.deps.db.reminders.get(id)
      if (!existing) throw new Error(`Reminder not found: ${id}`)
      const reminder = mutate(existing)
      this.log(toolName, { id }, reminder, 'ok', confirmed, source, startedAt)
      this.changed()
      return reminder
    } catch (error) {
      this.log(toolName, { id }, errorMessage(error), 'error', confirmed, source, startedAt)
      throw error
    }
  }

  private changed(): void {
    broadcast({ type: 'reminders_changed' })
    this.deps.onChanged()
  }

  private async safeNotificationAction(action: () => Reminder): Promise<void> {
    try {
      action()
    } catch (error) {
      console.error('[reminders] notification action failed', error)
    }
  }

  private log(
    toolName: string,
    args: unknown,
    result: unknown,
    status: 'ok' | 'error' | 'denied',
    confirmed: boolean | null,
    source: ActionSource,
    startedAt: number,
  ): void {
    this.deps.db.logs.add({
      toolName,
      args,
      result,
      status,
      confirmed,
      durationMs: Date.now() - startedAt,
      source,
      conversationId: null,
    })
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
