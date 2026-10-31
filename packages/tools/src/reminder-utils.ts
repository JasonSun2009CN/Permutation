import type { Reminder } from '@permutation/shared'

export function serializeReminder(reminder: Reminder): Record<string, unknown> {
  return {
    id: reminder.id,
    content: reminder.content,
    triggerAt: reminder.triggerAt,
    status: reminder.status,
    createdAt: reminder.createdAt,
    firedAt: reminder.firedAt,
  }
}
