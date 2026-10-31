import { isZonedIso } from '@permutation/shared'
import { z } from 'zod'
import { serializeReminder } from './reminder-utils'
import { formatWhen, tr, type ToolDefinition } from './types'

const schema = z
  .object({
    id: z.string().min(1).describe('Reminder id returned by list_reminders or create_reminder.'),
    content: z.string().min(1).max(500).optional().describe('New reminder text.'),
    triggerAt: z
      .string()
      .refine(isZonedIso, {
        message: 'triggerAt must be ISO 8601 with an explicit offset',
      })
      .optional()
      .describe('New trigger time as ISO 8601 with timezone offset.'),
  })
  .refine((value) => value.content !== undefined || value.triggerAt !== undefined, {
    message: 'Provide content, triggerAt, or both.',
  })

type Args = z.infer<typeof schema>

export const updateReminderTool: ToolDefinition = {
  name: 'update_reminder',
  description:
    'Update the text or trigger time of an existing reminder. Call list_reminders first if you do not know the id. Call get_current_time before computing a new relative time.',
  parameters: schema,
  requiresConfirmation: false,
  describe: (args, context) => {
    const parsed = args as Partial<Args>
    const existing = parsed.id ? context.db.reminders.get(parsed.id) : null
    const label = parsed.content ?? existing?.content ?? parsed.id ?? ''
    const when = parsed.triggerAt ? formatWhen(parsed.triggerAt, context) : null
    return tr(
      context,
      `修改提醒“${label}”${when ? `（新时间 ${when}）` : ''}`,
      `Update reminder "${label}"${when ? ` (new time ${when})` : ''}`,
    )
  },
  execute: (args, context) => {
    const { id, content, triggerAt } = args as Args
    const existing = context.db.reminders.get(id)
    if (!existing) throw new Error(`Reminder not found: ${id}`)
    if (triggerAt && new Date(triggerAt).getTime() < context.now().getTime() - 30_000) {
      throw new Error(
        'The requested time is in the past. Ask the user whether they meant the next occurrence.',
      )
    }
    const reminder = context.db.reminders.update(id, { content, triggerAt }, context.now())
    return {
      result: { ok: true, reminder: serializeReminder(reminder) },
      summary: tr(
        context,
        `已更新提醒“${reminder.content}”，时间 ${formatWhen(reminder.triggerAt, context)}。`,
        `Updated reminder "${reminder.content}" for ${formatWhen(reminder.triggerAt, context)}.`,
      ),
    }
  },
}
