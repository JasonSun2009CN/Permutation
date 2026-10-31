import { z } from 'zod'
import { serializeReminder } from './reminder-utils'
import { tr, type ToolDefinition } from './types'

const schema = z.object({
  id: z.string().min(1).describe('Reminder id to mark as completed.'),
})

type Args = z.infer<typeof schema>

export const completeReminderTool: ToolDefinition = {
  name: 'complete_reminder',
  description:
    'Mark a reminder as completed. Use this when the user says they already did the thing, instead of cancelling it. Use list_reminders first if you do not know the id.',
  parameters: schema,
  requiresConfirmation: false,
  describe: (args, context) => {
    const id = String((args as Partial<Args>).id ?? '')
    const existing = id ? context.db.reminders.get(id) : null
    return existing
      ? tr(context, `完成提醒“${existing.content}”`, `Complete reminder "${existing.content}"`)
      : tr(context, `完成提醒 ${id}`, `Complete reminder ${id}`)
  },
  execute: (args, context) => {
    const { id } = args as Args
    const existing = context.db.reminders.get(id)
    if (!existing) throw new Error(`Reminder not found: ${id}`)
    const reminder = context.db.reminders.complete(id, context.now())
    return {
      result: { ok: true, reminder: serializeReminder(reminder) },
      summary: tr(
        context,
        `已完成提醒“${reminder.content}”。`,
        `Completed reminder "${reminder.content}".`,
      ),
    }
  },
}
