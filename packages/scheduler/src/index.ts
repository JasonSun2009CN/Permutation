import type { ReminderRepository } from '@permutation/db'
import { SCHEDULER_TICK_MS, type Reminder } from '@permutation/shared'

export interface DueBatch {
  reminders: Reminder[]
  /** True when the reminders were already overdue when the app (re)started. */
  missed: boolean
}

export interface ReminderSchedulerOptions {
  reminders: ReminderRepository
  onDue: (batch: DueBatch) => void | Promise<void>
  onError?: (error: unknown) => void
  tickMs?: number
  now?: () => Date
}

/**
 * A deliberately small, database-backed scheduler.
 *
 * Every tick reads pending reminders whose trigger time has passed, marks them
 * fired, and hands them to the notification layer. Because state lives in
 * SQLite, quitting or crashing never loses a reminder: the next startup
 * catch-up fires whatever was missed.
 */
export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null
  private running = false
  private readonly tickMs: number
  private readonly now: () => Date

  constructor(private readonly options: ReminderSchedulerOptions) {
    this.tickMs = options.tickMs ?? SCHEDULER_TICK_MS
    this.now = options.now ?? (() => new Date())
  }

  start(): void {
    if (this.timer) return
    void this.catchUp()
    this.timer = setInterval(() => {
      void this.tick()
    }, this.tickMs)
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async catchUp(): Promise<Reminder[]> {
    return this.fireDue(true)
  }

  /** Wake the scheduler immediately after a reminder is created or edited. */
  async checkNow(): Promise<Reminder[]> {
    return this.fireDue(false)
  }

  async tick(): Promise<Reminder[]> {
    return this.fireDue(false)
  }

  private async fireDue(missed: boolean): Promise<Reminder[]> {
    if (this.running) return []
    this.running = true
    try {
      const now = this.now()
      const due = this.options.reminders.due(now)
      if (due.length === 0) return []

      const fired: Reminder[] = []
      for (const reminder of due) {
        fired.push(this.options.reminders.markFired(reminder.id, now))
      }

      try {
        await this.options.onDue({ reminders: fired, missed })
      } catch (error) {
        this.options.onError?.(error)
      }
      return fired
    } catch (error) {
      this.options.onError?.(error)
      return []
    } finally {
      this.running = false
    }
  }
}
