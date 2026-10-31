import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PermutationDatabase } from '@permutation/db'

describe('reminder repository', () => {
  let db: PermutationDatabase

  beforeEach(() => {
    db = openDatabase(':memory:')
  })

  it('applies migrations once', () => {
    db.migrate()
    db.migrate()
    const rows = db.raw.prepare('SELECT version FROM schema_migrations').all()
    expect(rows).toEqual([{ version: 1 }])
  })

  it('creates, lists and updates reminders', () => {
    const reminder = db.reminders.create({
      content: 'Drink water',
      triggerAt: '2026-10-31T15:00:00+08:00',
      source: 'manual',
    })
    expect(reminder.status).toBe('pending')
    expect(reminder.triggerAt).toBe('2026-10-31T07:00:00.000Z')

    const updated = db.reminders.update(reminder.id, {
      content: 'Drink more water',
      triggerAt: '2026-10-31T16:00:00+08:00',
    })
    expect(updated.content).toBe('Drink more water')
    expect(updated.triggerAt).toBe('2026-10-31T08:00:00.000Z')

    const open = db.reminders.list({ status: 'open' })
    expect(open).toHaveLength(1)
    expect(db.reminders.list({ status: 'completed' })).toHaveLength(0)
  })

  it('returns due reminders and marks them fired exactly once', () => {
    db.reminders.create({
      content: 'Due now',
      triggerAt: '2026-10-31T14:00:00Z',
    })
    db.reminders.create({
      content: 'Later',
      triggerAt: '2026-10-31T18:00:00Z',
    })

    const due = db.reminders.due(new Date('2026-10-31T15:00:00Z'))
    expect(due.map((item) => item.content)).toEqual(['Due now'])

    const fired = db.reminders.markFired(due[0]!.id, new Date('2026-10-31T15:00:00Z'))
    expect(fired.status).toBe('fired')
    expect(fired.firedAt).toBe('2026-10-31T15:00:00.000Z')

    expect(db.reminders.due(new Date('2026-10-31T15:00:00Z'))).toHaveLength(0)
  })

  it('snoozes from now and clears the fired state', () => {
    const reminder = db.reminders.create({
      content: 'Ping',
      triggerAt: '2026-10-31T14:00:00Z',
    })
    db.reminders.markFired(reminder.id, new Date('2026-10-31T14:00:00Z'))
    const snoozed = db.reminders.snooze(reminder.id, 10, new Date('2026-10-31T15:00:00Z'))
    expect(snoozed.status).toBe('pending')
    expect(snoozed.firedAt).toBeNull()
    expect(snoozed.triggerAt).toBe('2026-10-31T15:10:00.000Z')
  })

  it('refuses to edit completed reminders', () => {
    const reminder = db.reminders.create({
      content: 'Done thing',
      triggerAt: '2026-10-31T14:00:00Z',
    })
    db.reminders.complete(reminder.id)
    expect(() => db.reminders.update(reminder.id, { content: 'Nope' })).toThrow(/completed/)
  })
})
