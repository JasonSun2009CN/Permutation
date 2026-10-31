import { z } from 'zod'
import { serializeReminder } from './reminder-utils'
import { formatWhen, tr, type ToolDefinition } from './types'

const schema = z.object({
  id: z.string().min(1).describe('Reminder id to snooze.'),
  minutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .default(10)
    .describe('How many minutes to postpone the reminder from now.'),
})

type Args = z.infer<typeof schema>

export const snoozeReminderTool: ToolDefinition = {
  name: 'snooze_reminder',
  description:
    'Postpone a reminder by a number of minutes, measured from now. Use this when the user asks to be reminded again later.',
  parameters: schema,
  requiresConfirmation: false,
  describe: (args, context) => {
    const parsed = args as Partial<Args>
    const existing = parsed.id ? context.db.reminders.get(parsed.id) : null
    const minutes = parsed.minutes ?? 10
    return existing
      ? tr(
          context,
          `推迟提醒“${existing.content}” ${minutes} 分钟`,
          `Snooze reminder "${existing.content}" for ${minutes} minutes`,
        )
      : tr(context, `推迟提醒 ${parsed.id ?? ''}`, `Snooze reminder ${parsed.id ?? ''}`)
  },
  execute: (args, context) => {
    const { id, minutes } = args as Args
    const existing = context.db.reminders.get(id)
    if (!existing) throw new Error(`Reminder not found: ${id}`)
    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new Error(`Reminder ${id} is ${existing.status} and cannot be snoozed`)
    }
    const reminder = context.db.reminders.snooze(id, minutes, context.now())
    return {
      result: { ok: true, reminder: serializeReminder(reminder) },
      summary: tr(
        context,
        `已将提醒“${reminder.content}”推迟到 ${formatWhen(reminder.triggerAt, context)}。`,
        `Snoozed reminder "${reminder.content}" until ${formatWhen(reminder.triggerAt, context)}.`,
      ),
    }
  },
}
