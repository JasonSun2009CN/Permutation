import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openDatabase, type PermutationDatabase } from '@permutation/db'
import { ReminderScheduler, type DueBatch } from '@permutation/scheduler'

describe('scheduler', () => {
  let db: PermutationDatabase
  let now: Date
  let batches: DueBatch[]

  beforeEach(() => {
    db = openDatabase(':memory:')
    now = new Date('2026-10-31T10:00:00+08:00')
    batches = []
  })

  const makeScheduler = (): ReminderScheduler =>
    new ReminderScheduler({
      reminders: db.reminders,
      now: () => now,
      onDue: (batch) => {
        batches.push(batch)
      },
    })

  it('fires a reminder once when its time arrives', async () => {
    const reminder = db.reminders.create({
      content: '喝水',
      triggerAt: '2026-10-31T10:05:00+08:00',
    })
    const scheduler = makeScheduler()

    await scheduler.tick()
    expect(batches).toHaveLength(0)

    now = new Date('2026-10-31T10:05:01+08:00')
    await scheduler.tick()
    expect(batches).toHaveLength(1)
    expect(batches[0]?.missed).toBe(false)
    expect(batches[0]?.reminders[0]?.id).toBe(reminder.id)

    await scheduler.tick()
    expect(batches).toHaveLength(1)
    expect(db.reminders.get(reminder.id)?.status).toBe('fired')
  })

  it('catches up reminders that became due while the app was closed', async () => {
    db.reminders.create({
      content: '旧提醒',
      triggerAt: '2026-10-31T09:00:00+08:00',
    })
    now = new Date('2026-10-31T10:00:00+08:00')

    const restarted = makeScheduler()
    await restarted.catchUp()

    expect(batches).toHaveLength(1)
    expect(batches[0]?.missed).toBe(true)
    expect(batches[0]?.reminders[0]?.status).toBe('fired')
  })

  it('fires snoozed reminders again after the new trigger time', async () => {
    const reminder = db.reminders.create({
      content: '再提醒一次',
      triggerAt: '2026-10-31T10:05:00+08:00',
    })
    now = new Date('2026-10-31T10:06:00+08:00')
    const scheduler = makeScheduler()
    await scheduler.tick()
    expect(batches).toHaveLength(1)

    db.reminders.snooze(reminder.id, 10, now)
    now = new Date('2026-10-31T10:16:00+08:00')
    await scheduler.tick()
    expect(batches).toHaveLength(2)
    expect(batches[1]?.reminders[0]?.id).toBe(reminder.id)
  })

  it('reports onDue failures without crashing the loop', async () => {
    db.reminders.create({
      content: '会失败',
      triggerAt: '2026-10-31T09:00:00+08:00',
    })
    const onError = vi.fn()
    const scheduler = new ReminderScheduler({
      reminders: db.reminders,
      now: () => now,
      onDue: () => {
        throw new Error('notification failed')
      },
      onError,
    })
    await expect(scheduler.catchUp()).resolves.toHaveLength(1)
    expect(onError).toHaveBeenCalledOnce()
  })
})
