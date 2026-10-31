import { isZonedIso } from '@permutation/shared'
import { z } from 'zod'
import { serializeReminder } from './reminder-utils'
import { formatWhen, tr, type ToolDefinition } from './types'

const schema = z.object({
  content: z
    .string()
    .min(1)
    .max(500)
    .describe('Short reminder text, written in the user’s language.'),
  triggerAt: z
    .string()
    .refine(isZonedIso, {
      message: 'triggerAt must be ISO 8601 with an explicit offset, e.g. 2026-10-31T15:00:00+08:00',
    })
    .describe(
      'Exact moment to fire the reminder as ISO 8601 with a timezone offset. Compute it from get_current_time; never send a naive local time.',
    ),
})

type Args = z.infer<typeof schema>

export const createReminderTool: ToolDefinition = {
  name: 'create_reminder',
  description:
    'Create a one-off reminder that fires a system notification and an in-app card at a specific moment. Call get_current_time first for relative expressions. If the resulting time is in the past, do not guess: ask the user whether they meant the next occurrence.',
  parameters: schema,
  requiresConfirmation: false,
  describe: (args, context) => {
    const parsed = args as Partial<Args>
    const when = parsed.triggerAt ? formatWhen(parsed.triggerAt, context) : '?'
    return tr(
      context,
      `创建提醒“${parsed.content ?? ''}”（${when}）`,
      `Create reminder "${parsed.content ?? ''}" at ${when}`,
    )
  },
  execute: (args, context) => {
    const { content, triggerAt } = args as Args
    const triggerTime = new Date(triggerAt).getTime()
    if (triggerTime < context.now().getTime() - 30_000) {
      throw new Error(
        'The requested time is in the past. Ask the user whether they meant the next occurrence.',
      )
    }
    const reminder = context.db.reminders.create(
      { content, triggerAt, source: 'chat' },
      context.now(),
    )
    return {
      result: { ok: true, reminder: serializeReminder(reminder) },
      summary: tr(
        context,
        `已创建提醒“${content}”，时间 ${formatWhen(reminder.triggerAt, context)}。`,
        `Created reminder "${content}" for ${formatWhen(reminder.triggerAt, context)}.`,
      ),
    }
  },
}
