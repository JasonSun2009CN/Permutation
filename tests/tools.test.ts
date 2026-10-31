import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PermutationDatabase } from '@permutation/db'
import { defaultTools, ToolRegistry } from '@permutation/tools'

const NOW = new Date('2026-10-31T10:00:00+08:00')
const SIGNAL = new AbortController().signal

describe('tool registry', () => {
  let db: PermutationDatabase
  let notifyCalls: Array<{ title: string; body: string }>
  let registry: ToolRegistry

  beforeEach(() => {
    db = openDatabase(':memory:')
    notifyCalls = []
    const notify = (input: { title: string; body: string }) => {
      notifyCalls.push(input)
    }
    registry = new ToolRegistry(
      {
        db,
        now: () => NOW,
        timeZone: 'Asia/Shanghai',
        locale: 'zh-CN',
        language: 'zh',
        notify,
      },
      defaultTools,
    )
  })

  it('publishes JSON schemas for every default tool', () => {
    const specs = registry.specs()
    expect(specs.map((spec) => spec.name)).toEqual([
      'get_current_time',
      'create_reminder',
      'list_reminders',
      'update_reminder',
      'cancel_reminder',
      'complete_reminder',
      'snooze_reminder',
      'send_notification',
    ])
    const create = specs.find((spec) => spec.name === 'create_reminder')
    expect(create?.parameters).toMatchObject({ type: 'object' })
    expect(create?.parameters.$schema).toBeUndefined()
  })

  it('creates a reminder and records the action', async () => {
    const outcome = await registry.execute(
      'create_reminder',
      { content: '喝水', triggerAt: '2026-10-31T10:10:00+08:00' },
      { confirmed: null, signal: SIGNAL, conversationId: 'conv_test' },
    )

    expect(outcome.status).toBe('ok')
    expect(outcome.summary).toContain('喝水')
    expect(db.reminders.list({ status: 'open' })).toHaveLength(1)
    expect(db.logs.list()).toHaveLength(1)
    expect(db.logs.list()[0]?.toolName).toBe('create_reminder')
  })

  it('rejects naive timestamps without writing anything', async () => {
    const outcome = await registry.execute(
      'create_reminder',
      { content: '喝水', triggerAt: '2026-10-31T10:10' },
      { confirmed: null, signal: SIGNAL, conversationId: 'conv_test' },
    )
    expect(outcome.status).toBe('error')
    expect(outcome.result).toMatchObject({ error: 'Invalid tool arguments.' })
    expect(db.reminders.list({ status: 'all' })).toHaveLength(0)
  })

  it('rejects reminders in the past', async () => {
    const outcome = await registry.execute(
      'create_reminder',
      { content: '太迟了', triggerAt: '2026-10-31T09:00:00+08:00' },
      { confirmed: null, signal: SIGNAL, conversationId: 'conv_test' },
    )
    expect(outcome.status).toBe('error')
    expect(String((outcome.result as { error: string }).error)).toMatch(/past/i)
  })

  it('requires confirmation for cancel_reminder', async () => {
    const created = db.reminders.create({
      content: '交报告',
      triggerAt: '2026-10-31T10:30:00+08:00',
    })

    expect(registry.requiresConfirmation('cancel_reminder', { id: created.id })).toBe(true)
    expect(registry.describe('cancel_reminder', { id: created.id })).toContain('交报告')

    const denied = await registry.execute(
      'cancel_reminder',
      { id: created.id },
      { confirmed: false, signal: SIGNAL, conversationId: 'conv_test' },
    )
    expect(denied.status).toBe('denied')
    expect(db.reminders.get(created.id)?.status).toBe('pending')
    expect(db.logs.list()[0]?.confirmed).toBe(false)

    const approved = await registry.execute(
      'cancel_reminder',
      { id: created.id },
      { confirmed: true, signal: SIGNAL, conversationId: 'conv_test' },
    )
    expect(approved.status).toBe('ok')
    expect(db.reminders.get(created.id)?.status).toBe('cancelled')
  })

  it('lists, updates, completes and snoozes reminders', async () => {
    const created = db.reminders.create({
      content: '旧内容',
      triggerAt: '2026-10-31T10:30:00+08:00',
    })

    const listed = await registry.execute(
      'list_reminders',
      {},
      { confirmed: null, signal: SIGNAL, conversationId: 'conv_test' },
    )
    expect(listed.status).toBe('ok')
    expect((listed.result as { count: number }).count).toBe(1)

    const updated = await registry.execute(
      'update_reminder',
      { id: created.id, content: '新内容' },
      { confirmed: null, signal: SIGNAL, conversationId: 'conv_test' },
    )
    expect(updated.status).toBe('ok')
    expect(db.reminders.get(created.id)?.content).toBe('新内容')

    const snoozed = await registry.execute(
      'snooze_reminder',
      { id: created.id, minutes: 15 },
      { confirmed: null, signal: SIGNAL, conversationId: 'conv_test' },
    )
    expect(snoozed.status).toBe('ok')
    expect(db.reminders.get(created.id)?.triggerAt).toBe('2026-10-31T02:15:00.000Z')

    const completed = await registry.execute(
      'complete_reminder',
      { id: created.id },
      { confirmed: null, signal: SIGNAL, conversationId: 'conv_test' },
    )
    expect(completed.status).toBe('ok')
    expect(db.reminders.get(created.id)?.status).toBe('completed')
  })

  it('sends immediate notifications through the injected connector', async () => {
    const outcome = await registry.execute(
      'send_notification',
      { title: '现在', body: '站起来活动一下' },
      { confirmed: null, signal: SIGNAL, conversationId: 'conv_test' },
    )
    expect(outcome.status).toBe('ok')
    expect(notifyCalls).toEqual([{ title: '现在', body: '站起来活动一下' }])
  })

  it('returns an error for unknown tools instead of pretending success', async () => {
    const outcome = await registry.execute(
      'delete_everything',
      {},
      { confirmed: null, signal: SIGNAL, conversationId: 'conv_test' },
    )
    expect(outcome.status).toBe('error')
    expect(db.logs.list()[0]?.status).toBe('error')
  })
})
